"""
Outbound voice agent powered by Gemini Live native audio + LiveKit + Twilio SIP.

A single Gemini Live `RealtimeModel` handles STT, reasoning and TTS in one
streaming round-trip — there is no separate Deepgram / OpenAI / Cartesia
pipeline anymore.
"""

import os
import certifi

# Required before importing anything that opens TLS connections.
os.environ.setdefault("SSL_CERT_FILE", certifi.where())

import json
import logging
import time
from typing import Optional

from dotenv import load_dotenv
from google.genai import types as gtypes
from livekit import agents, api
from livekit.agents import Agent, AgentSession, RoomInputOptions, llm
from livekit.agents.llm import ChatMessage
from livekit.plugins import google, noise_cancellation, silero

import config

load_dotenv(".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice-agent")


# ---------------------------------------------------------------------------
# Transcript log
# Each line is one JSON record so the dashboard can tail it as a stream.
# ---------------------------------------------------------------------------
TRANSCRIPT_LOG = "/tmp/transcripts.jsonl"


def _emit_transcript(room: str, role: str, text: str, is_final: bool = True):
    """Append one transcript event to the JSONL log."""
    if not text:
        return
    record = {
        "ts": time.time(),
        "room": room,
        "role": role,        # "user" | "agent" | "system"
        "text": text,
        "is_final": is_final,
    }
    try:
        with open(TRANSCRIPT_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception as e:
        logger.warning("transcript write failed: %s", e)
    logger.info("[%s] %s: %s", role.upper(), room, text[:120])


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------
class TransferFunctions(llm.ToolContext):
    def __init__(self, ctx: agents.JobContext, phone_number: Optional[str] = None):
        super().__init__(tools=[])
        self.ctx = ctx
        self.phone_number = phone_number

    @llm.function_tool(description="Look up user details by phone number.")
    def lookup_user(self, phone: str):
        logger.info("Looking up user: %s", phone)
        return (
            "User found: Shreyas Raj. Status: Premium. "
            "Last order: Coffee setup (Delivered)."
        )

    @llm.function_tool(
        description="Transfer the call to a human or another phone number."
    )
    async def transfer_call(self, destination: Optional[str] = None):
        if destination is None:
            destination = config.DEFAULT_TRANSFER_NUMBER
            if not destination:
                return "Error: no default transfer number configured."

        # Build a SIP URI if the caller passed a bare number.
        if "@" not in destination:
            clean = destination.replace("tel:", "").replace("sip:", "")
            if config.SIP_DOMAIN:
                destination = f"sip:{clean}@{config.SIP_DOMAIN}"
            elif not destination.startswith(("tel:", "sip:")):
                destination = f"tel:{clean}"
        elif not destination.startswith("sip:"):
            destination = f"sip:{destination}"

        # Identify which participant to transfer.
        identity = None
        if self.phone_number:
            identity = f"sip_{self.phone_number}"
        else:
            for p in self.ctx.room.remote_participants.values():
                identity = p.identity
                break

        if not identity:
            logger.error("No remote participant to transfer.")
            return "Failed to transfer: could not identify the caller."

        try:
            logger.info("Transferring %s -> %s", identity, destination)
            await self.ctx.api.sip.transfer_sip_participant(
                api.TransferSIPParticipantRequest(
                    room_name=self.ctx.room.name,
                    participant_identity=identity,
                    transfer_to=destination,
                    play_dialtone=False,
                )
            )
            return "Transfer initiated successfully."
        except Exception as e:
            logger.exception("Transfer failed")
            return f"Error executing transfer: {e}"


# ---------------------------------------------------------------------------
# Realtime model factory
# ---------------------------------------------------------------------------
def _build_realtime_model(voice: Optional[str] = None,
                          temperature: Optional[float] = None,
                          system_prompt: Optional[str] = None):
    """Create a Gemini Live realtime model. Voice / temperature / instructions
    can be overridden per-call via room metadata."""
    voice = voice or config.GEMINI_VOICE
    temp = temperature if temperature is not None else config.GEMINI_TEMPERATURE

    if not config.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY (or GOOGLE_API_KEY) is missing. Set it in .env."
        )

    logger.info(
        "Gemini Live: model=%s voice=%s temp=%.2f",
        config.GEMINI_LIVE_MODEL, voice, temp,
    )

    return google.realtime.RealtimeModel(
        model=config.GEMINI_LIVE_MODEL,
        api_key=config.GEMINI_API_KEY,
        voice=voice,
        temperature=temp,
        instructions=system_prompt or config.SYSTEM_PROMPT,
        # Ask Gemini to also emit text transcripts for both sides of the call.
        input_audio_transcription=gtypes.AudioTranscriptionConfig(),
        output_audio_transcription=gtypes.AudioTranscriptionConfig(),
    )


class OutboundAssistant(Agent):
    def __init__(self, tools: list, instructions: str) -> None:
        super().__init__(instructions=instructions, tools=tools)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
async def entrypoint(ctx: agents.JobContext):
    logger.info("Connecting to room: %s", ctx.room.name)

    phone_number: Optional[str] = None
    meta: dict = {}

    # Job metadata (when dispatched via AgentDispatch).
    try:
        if ctx.job.metadata:
            data = json.loads(ctx.job.metadata)
            phone_number = data.get("phone_number")
            meta.update(data)
    except Exception:
        pass

    # Room metadata (set by the Next.js dashboard) — wins over job metadata.
    try:
        if ctx.room.metadata:
            data = json.loads(ctx.room.metadata)
            if data.get("phone_number"):
                phone_number = data.get("phone_number")
            meta.update(data)
    except Exception:
        logger.warning("No valid JSON metadata on room.")

    user_prompt = meta.get("user_prompt") or ""
    system_prompt_override = (meta.get("system_prompt") or "").strip()
    base_prompt = system_prompt_override or config.SYSTEM_PROMPT
    instructions = base_prompt
    if user_prompt:
        instructions = f"{base_prompt}\n\nCampaign context:\n{user_prompt}"

    fnc_ctx = TransferFunctions(ctx, phone_number)

    realtime = _build_realtime_model(
        voice=meta.get("voice_id"),
        temperature=meta.get("temperature"),
        system_prompt=instructions,
    )

    session = AgentSession(
        vad=silero.VAD.load(),
        llm=realtime,  # Gemini Live combines STT/LLM/TTS in one model.
    )

    room_name = ctx.room.name
    _emit_transcript(room_name, "system", f"Call started -> {phone_number or 'inbound'}")

    @session.on("user_input_transcribed")
    def _on_user_input(ev):
        # Streaming partials + final. We only persist finals to keep the log clean.
        if getattr(ev, "is_final", False):
            _emit_transcript(room_name, "user", ev.transcript or "", is_final=True)

    @session.on("conversation_item_added")
    def _on_item(ev):
        item = getattr(ev, "item", None)
        if isinstance(item, ChatMessage):
            text = item.text_content or ""
            role = item.role  # "user" | "assistant" | "system"
            mapped = "agent" if role == "assistant" else role
            # Skip user echoes — already written by user_input_transcribed.
            if mapped == "user":
                return
            _emit_transcript(room_name, mapped, text)

    await session.start(
        room=ctx.room,
        agent=OutboundAssistant(
            tools=list(fnc_ctx.function_tools.values()),
            instructions=instructions,
        ),
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVCTelephony(),
            close_on_disconnect=True,
        ),
    )

    # Decide whether the agent itself needs to dial out.
    should_dial = False
    if phone_number:
        already_present = any(
            "sip_" in p.identity for p in ctx.room.remote_participants.values()
        )
        should_dial = not already_present

    if should_dial:
        if not config.SIP_TRUNK_ID:
            logger.error("SIP_TRUNK_ID not configured — cannot dial out.")
            ctx.shutdown()
            return

        logger.info("Dialing %s via trunk %s", phone_number, config.SIP_TRUNK_ID)
        try:
            await ctx.api.sip.create_sip_participant(
                api.CreateSIPParticipantRequest(
                    room_name=ctx.room.name,
                    sip_trunk_id=config.SIP_TRUNK_ID,
                    sip_call_to=phone_number,
                    participant_identity=f"sip_{phone_number}",
                    wait_until_answered=True,
                )
            )
            logger.info("Call answered.")
            await session.generate_reply(instructions=config.INITIAL_GREETING)
        except Exception as e:
            logger.exception("Outbound dial failed: %s", e)
            ctx.shutdown()
    else:
        logger.info("Participant already in room — greeting.")
        await session.generate_reply(instructions=config.FALLBACK_GREETING)

    async def _on_shutdown():
        _emit_transcript(room_name, "system", "Call ended")

    ctx.add_shutdown_callback(_on_shutdown)


if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="outbound-caller",
        )
    )
