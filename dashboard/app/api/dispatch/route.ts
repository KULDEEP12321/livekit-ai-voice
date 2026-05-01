import { NextResponse } from 'next/server';
import { sipClient, roomService, dispatchClient, SIP_TRUNK_ID, AGENT_NAME } from '@/lib/server-utils';


/**
 * Dispatch a single outbound call.
 *
 * Flow:
 *  1. Create a room with metadata (so the agent picks up the campaign context).
 *  2. Trigger an explicit AgentDispatch — guarantees the `outbound-caller`
 *     worker joins this specific room.
 *  3. Add the SIP participant — Twilio dials the phone number into the room.
 */
export async function POST(request: Request) {
    try {
        const { phoneNumber, prompt, voice, temperature, systemPrompt } = await request.json();

        if (!phoneNumber) {
            return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 });
        }
        if (!SIP_TRUNK_ID) {
            return NextResponse.json({ error: 'SIP_TRUNK_ID not configured' }, { status: 500 });
        }

        const safePhone = phoneNumber.replace(/[^\d+]/g, '');
        const roomName = `call-${safePhone.replace('+', '')}-${Math.floor(Math.random() * 10000)}`;
        const participantIdentity = `sip_${safePhone}`;

        const metadata = JSON.stringify({
            phone_number: safePhone,
            user_prompt: prompt || '',
            system_prompt: systemPrompt || undefined,
            voice_id: voice || undefined,
            temperature: temperature !== undefined ? Number(temperature) : undefined,
        });

        await roomService.createRoom({ name: roomName, metadata, emptyTimeout: 60 * 5 });

        await dispatchClient.createDispatch(roomName, AGENT_NAME, { metadata });

        const info = await sipClient.createSipParticipant(SIP_TRUNK_ID, safePhone, roomName, {
            participantIdentity,
            participantName: 'Customer',
        });

        return NextResponse.json({ success: true, roomName, dispatchId: info.sipCallId });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Internal Server Error';
        console.error('dispatch error:', err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
