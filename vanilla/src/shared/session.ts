import {getEnv} from './env';

export function getSession(): string {
    const raw = getEnv('VITE_PURSE_SESSION_JSON');
    if (!raw) throw new Error('No session — set VITE_PURSE_SESSION_JSON in .env.local or the debug panel');
    const s = raw.trim().replace(/=+$/, '');
    return s + '='.repeat((4 - (s.length % 4)) % 4);
}
