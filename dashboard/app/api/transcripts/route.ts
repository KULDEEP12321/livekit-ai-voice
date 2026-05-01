import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';

export const dynamic = 'force-dynamic';

const LOG_PATH = process.env.TRANSCRIPT_LOG || '/tmp/transcripts.jsonl';

type Entry = {
    ts: number;
    room: string;
    role: 'user' | 'agent' | 'system';
    text: string;
    is_final: boolean;
};

/**
 * Polling endpoint. The client passes `since` (the latest `ts` it has) and the
 * server returns every newer record. On first call, pass `since=0` and we
 * return the last `tail` records (default 200).
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const roomFilter = searchParams.get('room');
    const since = Number(searchParams.get('since') ?? 0);
    const tailN = Math.max(0, Math.min(500, Number(searchParams.get('tail') ?? 200)));

    let buf: string;
    try {
        buf = await fs.readFile(LOG_PATH, 'utf8');
    } catch {
        return NextResponse.json({ records: [], lastTs: 0 });
    }

    const lines = buf.split('\n').filter(Boolean);
    const records: Entry[] = [];
    for (const line of lines) {
        try {
            const rec = JSON.parse(line) as Entry;
            if (roomFilter && rec.room !== roomFilter) continue;
            if (since > 0 && rec.ts <= since) continue;
            records.push(rec);
        } catch { /* skip malformed */ }
    }

    // First fetch (since=0): trim to last tailN to avoid huge payload.
    const out = since === 0 ? records.slice(-tailN) : records;
    const lastTs = out.length ? out[out.length - 1].ts : since;

    return NextResponse.json({ records: out, lastTs });
}
