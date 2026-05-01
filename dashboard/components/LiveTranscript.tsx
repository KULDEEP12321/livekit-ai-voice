"use client";

import { useEffect, useRef, useState, ElementType } from 'react';
import { MessageCircle, User, Bot, Settings } from 'lucide-react';

type Entry = {
    ts: number;
    room: string;
    role: 'user' | 'agent' | 'system';
    text: string;
    is_final: boolean;
};

type RoleStyle = { icon: ElementType; bg: string; label: string; text: string };

const ROLE_STYLES: Record<string, RoleStyle> = {
    user:   { icon: User,     bg: 'bg-blue-500/10 border-blue-500/30',     label: 'Caller', text: 'text-blue-200' },
    agent:  { icon: Bot,      bg: 'bg-purple-500/10 border-purple-500/30', label: 'Agent',  text: 'text-purple-200' },
    system: { icon: Settings, bg: 'bg-white/5 border-white/10',            label: 'System', text: 'text-gray-400' },
};

function formatTime(ts: number) {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function LiveTranscript({ room }: { room?: string }) {
    const [records, setRecords] = useState<Entry[]>([]);
    const [connected, setConnected] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        let since = 0;

        const poll = async () => {
            const params = new URLSearchParams();
            if (room) params.set('room', room);
            params.set('since', String(since));
            params.set('tail', '200');
            try {
                const res = await fetch(`/api/transcripts?${params}`, { cache: 'no-store' });
                if (!res.ok) throw new Error(`status ${res.status}`);
                const data = await res.json() as { records: Entry[]; lastTs: number };
                if (cancelled) return;
                if (data.records.length) {
                    setRecords((prev) => [...prev, ...data.records].slice(-500));
                    since = data.lastTs || since;
                }
                setConnected(true);
            } catch {
                if (!cancelled) setConnected(false);
            }
        };

        poll();
        const id = setInterval(poll, 1500);
        return () => { cancelled = true; clearInterval(id); };
    }, [room]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [records]);

    return (
        <div className="relative w-full max-w-5xl">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl opacity-50 blur-lg"></div>
            <div className="relative p-6 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <MessageCircle className="w-5 h-5 text-cyan-400" />
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
                            Live Transcript
                        </h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${connected ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                            {connected ? '● connected' : '○ disconnected'}
                        </span>
                        {room && <span className="text-xs text-gray-500 font-mono">{room}</span>}
                    </div>
                    <button
                        onClick={() => setRecords([])}
                        className="text-xs text-gray-400 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
                    >
                        Clear
                    </button>
                </div>

                <div ref={scrollRef} className="h-72 overflow-y-auto space-y-2 pr-2">
                    {records.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 text-sm">
                            Waiting for transcripts… start a call to see audio transcribed in real time.
                        </div>
                    ) : (
                        records.map((r, i) => {
                            const style = ROLE_STYLES[r.role] ?? ROLE_STYLES.system;
                            const Icon = style.icon;
                            return (
                                <div key={i} className={`flex gap-3 p-3 rounded-lg border ${style.bg}`}>
                                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${style.text}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
                                            <span className="text-xs text-gray-600">{formatTime(r.ts)}</span>
                                            {!r.is_final && <span className="text-xs text-gray-600 italic">typing…</span>}
                                        </div>
                                        <div className="text-sm text-gray-200 break-words">{r.text}</div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
