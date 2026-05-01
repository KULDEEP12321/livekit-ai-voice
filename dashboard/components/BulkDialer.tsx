"use client";

import { useState, useEffect } from 'react';
import { Users, FileText, Loader2, CheckCircle, AlertCircle, Bot } from 'lucide-react';
import { GEMINI_VOICES, voiceLabel } from '../lib/voices';

const SYSTEM_PROMPT_KEY = 'rapidx.bulk.systemPrompt';
const VOICE_KEY = 'rapidx.bulk.voice';

type Result = { phoneNumber: string; status: 'dispatched' | 'failed'; id?: string; error?: string };

export default function BulkDialer() {
    const [input, setInput] = useState('');
    const [prompt, setPrompt] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [voice, setVoice] = useState('Aoede');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [results, setResults] = useState<Result[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem(SYSTEM_PROMPT_KEY);
        if (saved) setSystemPrompt(saved);
        const savedVoice = localStorage.getItem(VOICE_KEY);
        if (savedVoice) setVoice(savedVoice);
    }, []);

    useEffect(() => {
        localStorage.setItem(SYSTEM_PROMPT_KEY, systemPrompt);
    }, [systemPrompt]);

    useEffect(() => {
        localStorage.setItem(VOICE_KEY, voice);
    }, [voice]);

    const handleBulkDispatch = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setResults([]);

        const numbers = input.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
        if (numbers.length === 0) {
            setStatus('error');
            return;
        }

        try {
            const res = await fetch('/api/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numbers, prompt, voice, systemPrompt }),
            });
            const data = await res.json();
            setResults(data.results || []);
            setStatus(res.ok ? 'success' : 'error');
        } catch {
            setStatus('error');
        }
    };

    return (
        <div className="relative group max-w-md w-full">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-teal-600 rounded-2xl opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 blur-lg"></div>

            <div className="relative p-8 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-teal-400">
                            Bulk Operations
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">Queue many numbers at once</p>
                    </div>
                    <Users className="w-5 h-5 text-teal-400" />
                </div>

                <form onSubmit={handleBulkDispatch} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400 font-medium flex items-center gap-2">
                            <Users className="w-4 h-4" /> Phone Numbers
                        </label>
                        <textarea
                            placeholder="+919876543210&#10;+919988776655&#10;+12125551234"
                            required
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-white placeholder-gray-600 outline-none transition-all duration-300 h-32 resize-none font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 text-right">comma or newline separated</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-gray-400 font-medium flex items-center gap-2">
                            <Bot className="w-4 h-4" /> System Prompt <span className="text-gray-600 text-xs font-normal">(persona — leave blank for server default)</span>
                        </label>
                        <textarea
                            placeholder={"e.g. You are an outbound caller from Rapid X High School running an admissions campaign..."}
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-white placeholder-gray-600 outline-none transition-all duration-300 h-28 resize-none text-sm"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-gray-400 font-medium flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Campaign Context <span className="text-gray-600 text-xs font-normal">(appended to persona)</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Survey about recent purchase..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-white placeholder-gray-600 outline-none transition-all duration-300"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-gray-400 font-medium">Voice</label>
                        <select
                            value={voice}
                            onChange={(e) => setVoice(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-green-500"
                        >
                            {GEMINI_VOICES.map((v) => (
                                <option key={v.id} value={v.id}>{voiceLabel(v)}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg hover:shadow-green-500/25 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {status === 'loading' ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Processing Queue...</>
                        ) : 'Launch Campaign'}
                    </button>

                    {results.length > 0 && (
                        <div className="max-h-40 overflow-y-auto space-y-2 mt-4">
                            {results.map((res, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded bg-white/5 text-xs">
                                    <span className="font-mono text-gray-300">{res.phoneNumber}</span>
                                    {res.status === 'dispatched' ? (
                                        <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Sent</span>
                                    ) : (
                                        <span className="text-red-400 flex items-center gap-1" title={res.error}><AlertCircle className="w-3 h-3" /> Failed</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
