# Rapid X AI · LiveKit Voice Agent

Outbound voice agent built on **Gemini Live** (native audio), **LiveKit** (rooms + SIP) and **Twilio** (PSTN). Comes with a Next.js dashboard for dispatching single or bulk calls and watching live sessions.

## Architecture

```
 ┌────────────┐   HTTP    ┌──────────────────┐   LiveKit RPC   ┌──────────────┐
 │ Dashboard  │──────────▶│  Next.js routes  │────────────────▶│  LiveKit     │
 │ (Next.js)  │           │  /api/dispatch   │                 │  Cloud       │
 └────────────┘           │  /api/queue      │                 │  + SIP trunk │
                          │  /api/calls      │◀────────────────│              │
                          └──────────────────┘                 └──────┬───────┘
                                                                       │ WebRTC
                                                                       ▼
                                                              ┌──────────────────┐
                                                              │  agent.py        │
                                                              │  Gemini Live     │
                                                              │  (STT+LLM+TTS)   │
                                                              └──────────────────┘
                                                                       │ SIP
                                                                       ▼
                                                                  Twilio PSTN
```

A single Gemini Live `RealtimeModel` replaces the old Deepgram + OpenAI/Groq + Cartesia/Sarvam pipeline — one streaming round-trip, lower latency, fewer keys to manage.

## Setup

### 1. Configure environment

```bash
cp .env.example .env
# Then edit .env with your real LiveKit, Gemini and Twilio credentials.
```

### 2. Python agent

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python agent.py start
```

### 3. Dashboard

```bash
cd dashboard
npm install
npm run dev
# Opens on http://${HOST}:${PORT}  (defaults to 0.0.0.0:3000)
```

The dashboard reads `.env` from the repo root via `dotenv` because Next.js auto-loads `.env`/`.env.local` from its own folder. If you want one shared file, symlink it:

```bash
ln -s ../.env dashboard/.env.local
```

### 4. Docker (agent + dashboard)

```bash
docker compose up --build
```

## SIP trunk management

```bash
python list_trunks.py            # list trunks on this LiveKit project
python create_trunk.py           # create one from .env (writes Twilio creds)
python setup_trunk.py            # update an existing trunk in-place
```

## CLI dialing (no dashboard needed)

```bash
python make_call.py --to +919876543210 --voice Puck --prompt "Survey about coffee order"
```

## Dashboard endpoints

| Route               | Method | Purpose                                      |
| ------------------- | ------ | -------------------------------------------- |
| `/api/dispatch`     | POST   | Dispatch one outbound call                   |
| `/api/queue`        | POST   | Bulk dispatch a list of numbers              |
| `/api/calls`        | GET    | List active call rooms                       |
| `/api/calls`        | DELETE | Hang up a specific room (`{ roomName }`)     |

## Files

- `agent.py` — LiveKit worker; runs the Gemini Live realtime model.
- `config.py` — central config; reads `.env`, supports legacy `VOBIZ_*` names.
- `make_call.py` — CLI to dispatch a single call via `AgentDispatch`.
- `create_trunk.py` / `setup_trunk.py` / `list_trunks.py` — SIP trunk admin.
- `dashboard/` — Next.js app (UI + API routes).

## Troubleshooting

- **`GEMINI_API_KEY missing`** — set either `GEMINI_API_KEY` or `GOOGLE_API_KEY` in `.env`.
- **`SIP_TRUNK_ID not configured`** — run `python list_trunks.py`; if empty, run `python create_trunk.py`.
- **Twilio auth retries** — re-run `python setup_trunk.py` after rotating credentials.
- **Dashboard 500s** — make sure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` are exported in the env that runs `npm run dev`.
- **Agent connects but no audio** — confirm the SIP trunk's `address` matches the Twilio Termination URI exactly, including the region prefix.
