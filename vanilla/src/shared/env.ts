const LS_PREFIX = 'purse_debug_';

export const ENV_KEYS = [
    'VITE_PURSE_ENVIRONMENT',
    'VITE_PURSE_SESSION_JSON',
    'VITE_PURSE_SECUREFIELDS_TENANT_ID',
    'VITE_PURSE_API_KEY',
] as const;

export type EnvKey = (typeof ENV_KEYS)[number];

const BUILD_DEFAULTS: Record<EnvKey, string> = {
    VITE_PURSE_ENVIRONMENT: import.meta.env.VITE_PURSE_ENVIRONMENT ?? 'sandbox',
    VITE_PURSE_SESSION_JSON: import.meta.env.VITE_PURSE_SESSION_JSON ?? '',
    VITE_PURSE_SECUREFIELDS_TENANT_ID: import.meta.env.VITE_PURSE_SECUREFIELDS_TENANT_ID ?? '',
    VITE_PURSE_API_KEY: import.meta.env.VITE_PURSE_API_KEY ?? '',
};

export function getEnv(key: EnvKey): string {
    return localStorage.getItem(LS_PREFIX + key) ?? BUILD_DEFAULTS[key];
}

export function setEnv(key: EnvKey, value: string): void {
    const trimmed = value.trim();
    if (!trimmed || trimmed === BUILD_DEFAULTS[key]) {
        localStorage.removeItem(LS_PREFIX + key);
    } else {
        localStorage.setItem(LS_PREFIX + key, trimmed);
    }
}

export function resetEnv(key: EnvKey): void {
    localStorage.removeItem(LS_PREFIX + key);
}

export function resetAllEnv(): void {
    for (const k of ENV_KEYS) localStorage.removeItem(LS_PREFIX + k);
}

export function isOverridden(key: EnvKey): boolean {
    return localStorage.getItem(LS_PREFIX + key) !== null;
}

export function getBuildDefault(key: EnvKey): string {
    return BUILD_DEFAULTS[key];
}

export function getEnvironment(): 'sandbox' | 'production' | undefined {
    return getEnv('VITE_PURSE_ENVIRONMENT') as 'sandbox' | 'production' | undefined;
}
