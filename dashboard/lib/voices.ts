/**
 * Gemini Live native-audio voices.
 *
 * Descriptions reflect Google's published voice characteristics. The
 * `recommendedFor` flag highlights the picks that fit the current
 * "Rapid X High School Receptionist" persona — warm, polite, female.
 * Reorder or update as the persona changes.
 */

export type GeminiVoice = {
    id: string;
    gender: 'female' | 'male';
    description: string;
    recommendedFor?: 'receptionist';
};

export const GEMINI_VOICES: GeminiVoice[] = [
    { id: 'Aoede', gender: 'female', description: 'Breezy, warm', recommendedFor: 'receptionist' },
    { id: 'Kore', gender: 'female', description: 'Firm, confident', recommendedFor: 'receptionist' },
    { id: 'Zephyr', gender: 'female', description: 'Bright, friendly', recommendedFor: 'receptionist' },
    { id: 'Leda', gender: 'female', description: 'Youthful' },
    { id: 'Puck', gender: 'male', description: 'Upbeat, conversational' },
    { id: 'Charon', gender: 'male', description: 'Informative, deeper' },
    { id: 'Fenrir', gender: 'male', description: 'Excitable, energetic' },
    { id: 'Orus', gender: 'male', description: 'Firm, professional' },
];

export const voiceLabel = (v: GeminiVoice) =>
    `${v.id} — ${v.description}${v.recommendedFor === 'receptionist' ? ' ★' : ''}`;
