"use client";

import { useEffect, useState, useCallback } from 'react';
import { Activity, PhoneOff, RefreshCw, Loader2 } from 'lucide-react';

type Call = {
    roomName: string;
    sid: string;
    numParticipants: number;
    creationTime: number;
    phone: string | null;
    voice: string | null;
    prompt: string;
};

function formatRelative(unix: number) {
    if (!unix) return '—';
    const seconds = Math.floor(Date.now() / 1000 - unix);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
}

export default function LiveCalls() {
    const [calls, setCalls] = useState<Call[]>([]);
    const [loading, setLoading] = useState(false);
    const [hangingUp, setHangingUp] = useState<string | null>(null);

    const fetchCalls = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/calls', { cache: 'no-store' });
            const data = await res.json();
            setCalls(data.calls || []);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, []);

    const hangup = async (roomName: string) => {
        setHangingUp(roomName);
        try {
            await fetch('/api/calls', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName }),
            });
            await fetchCalls();
        } finally {
            setHangingUp(null);
        }
    };

    useEffect(() => {
        fetchCalls();
        const id = setInterval(fetchCalls, 5000);
        return () => clearInterval(id);
    }, [fetchCalls]);

    return (
        <div className="relative group w-full max-w-5xl">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-orange-500 rounded-2xl opacity-50 blur-lg"></div>
            <div className="relative p-8 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-pink-400" />
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-orange-400">
                            Live Calls
                        </h2>
                        <span className="text-xs text-gray-500">{calls.length} active</span>
                    </div>
                    <button
                        onClick={fetchCalls}
                        disabled={loading}
                        className="px-3 py-1.5 text-xs text-gray-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Refresh
                    </button>
                </div>

                {calls.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 text-sm">
                        No active calls. Dispatch one above to see it here.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 uppercase border-b border-white/10">
                                    <th className="pb-3 font-medium">Phone</th>
                                    <th className="pb-3 font-medium">Voice</th>
                                    <th className="pb-3 font-medium">Participants</th>
                                    <th className="pb-3 font-medium">Started</th>
                                    <th className="pb-3 font-medium">Room</th>
                                    <th className="pb-3 font-medium text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {calls.map((c) => (
                                    <tr key={c.sid} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="py-3 font-mono text-white">{c.phone || '—'}</td>
                                        <td className="py-3 text-gray-300">{c.voice || '—'}</td>
                                        <td className="py-3 text-gray-300">{c.numParticipants}</td>
                                        <td className="py-3 text-gray-500">{formatRelative(c.creationTime)}</td>
                                        <td className="py-3 font-mono text-xs text-gray-500 truncate max-w-[180px]">{c.roomName}</td>
                                        <td className="py-3 text-right">
                                            <button
                                                onClick={() => hangup(c.roomName)}
                                                disabled={hangingUp === c.roomName}
                                                className="px-3 py-1.5 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 inline-flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {hangingUp === c.roomName ? <Loader2 className="w-3 h-3 animate-spin" /> : <PhoneOff className="w-3 h-3" />}
                                                Hang up
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
