import { NextResponse } from 'next/server';
import { roomService } from '@/lib/server-utils';

/** Returns the list of currently active call rooms (those prefixed `call-`). */
export async function GET() {
    try {
        const rooms = await roomService.listRooms();
        const calls = rooms
            .filter((r) => r.name.startsWith('call-'))
            .map((r) => {
                let meta: Record<string, unknown> = {};
                try { meta = r.metadata ? JSON.parse(r.metadata) : {}; } catch { /* ignore */ }
                return {
                    roomName: r.name,
                    sid: r.sid,
                    numParticipants: r.numParticipants,
                    creationTime: Number(r.creationTime),
                    phone: meta.phone_number ?? null,
                    voice: meta.voice_id ?? null,
                    prompt: meta.user_prompt ?? '',
                };
            })
            .sort((a, b) => b.creationTime - a.creationTime);

        return NextResponse.json({ calls });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Internal Server Error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/** Hang up / delete a call room. Body: { roomName: string } */
export async function DELETE(request: Request) {
    try {
        const { roomName } = await request.json();
        if (!roomName) {
            return NextResponse.json({ error: 'roomName required' }, { status: 400 });
        }
        await roomService.deleteRoom(roomName);
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Internal Server Error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
