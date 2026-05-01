import { RoomServiceClient, SipClient, AgentDispatchClient } from 'livekit-server-sdk';

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  throw new Error('Missing LiveKit credentials. Set LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET in .env');
}

export const SIP_TRUNK_ID =
  process.env.SIP_TRUNK_ID || process.env.VOBIZ_SIP_TRUNK_ID || '';

export const AGENT_NAME = process.env.AGENT_NAME || 'outbound-caller';

export const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
export const sipClient = new SipClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
export const dispatchClient = new AgentDispatchClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
