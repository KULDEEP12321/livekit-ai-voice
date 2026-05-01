import { NextResponse } from 'next/server';
import { roomService, sipClient, dispatchClient, SIP_TRUNK_ID, AGENT_NAME } from '@/lib/server-utils';

/** Bulk-dispatch a list of phone numbers, one room per number. */
export async function POST(request: Request) {
    try {
        const { numbers, prompt, voice, temperature, systemPrompt } = await request.json();

        if (!Array.isArray(numbers) || numbers.length === 0) {
            return NextResponse.json({ error: 'numbers[] required' }, { status: 400 });
        }
        if (!SIP_TRUNK_ID) {
            return NextResponse.json({ error: 'SIP_TRUNK_ID not configured' }, { status: 500 });
        }

        const results: Array<{ phoneNumber: string; status: string; id?: string; error?: string }> = [];

        for (const raw of numbers) {
            const phoneNumber = String(raw).trim().replace(/[^\d+]/g, '');
            if (!phoneNumber.startsWith('+')) {
                results.push({ phoneNumber, status: 'failed', error: 'must start with +' });
                continue;
            }

            const roomName = `call-${phoneNumber.replace('+', '')}-${Math.floor(Math.random() * 10000)}`;
            const participantIdentity = `sip_${phoneNumber}`;

            const metadata = JSON.stringify({
                phone_number: phoneNumber,
                user_prompt: prompt || '',
                system_prompt: systemPrompt || undefined,
                voice_id: voice || undefined,
                temperature: temperature !== undefined ? Number(temperature) : undefined,
            });

            try {
                await roomService.createRoom({ name: roomName, metadata, emptyTimeout: 60 * 5 });
                await dispatchClient.createDispatch(roomName, AGENT_NAME, { metadata });
                const info = await sipClient.createSipParticipant(SIP_TRUNK_ID, phoneNumber, roomName, {
                    participantIdentity,
                    participantName: 'Customer',
                });
                results.push({ phoneNumber, status: 'dispatched', id: info.sipCallId });
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'unknown error';
                console.error(`Failed to dispatch ${phoneNumber}:`, e);
                results.push({ phoneNumber, status: 'failed', error: msg });
            }

            await new Promise((r) => setTimeout(r, 200));
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${numbers.length} numbers`,
            results,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Internal Server Error';
        console.error('queue error:', err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
