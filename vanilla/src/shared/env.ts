const LS_PREFIX = 'purse_debug_';

export const ENV_KEYS = [
    'VITE_PURSE_ENVIRONMENT',
    'VITE_PURSE_SESSION_JSON',
    'VITE_PURSE_SECUREFIELDS_TENANT_ID',
    'VITE_PURSE_API_KEY',
    'VITE_PURSE_ENTITY_ID',
    'VITE_PURSE_PROXY_URL',
] as const;

export type EnvKey = (typeof ENV_KEYS)[number];

const BUILD_DEFAULTS: Record<EnvKey, string> = {
    VITE_PURSE_ENVIRONMENT: import.meta.env.VITE_PURSE_ENVIRONMENT ?? 'sandbox',
    VITE_PURSE_SESSION_JSON: import.meta.env.VITE_PURSE_SESSION_JSON ?? '',
    VITE_PURSE_SECUREFIELDS_TENANT_ID: import.meta.env.VITE_PURSE_SECUREFIELDS_TENANT_ID ?? '',
    VITE_PURSE_API_KEY: import.meta.env.VITE_PURSE_API_KEY ?? '',
    VITE_PURSE_ENTITY_ID: import.meta.env.VITE_PURSE_ENTITY_ID ?? '',
    VITE_PURSE_PROXY_URL: import.meta.env.VITE_PURSE_PROXY_URL ?? '',
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
    resetForKeys(ENV_KEYS);
}

// Clear the overrides for a subset of the keys — the debug panel only resets
// what it displays for the current demo.
export function resetForKeys(keys: readonly EnvKey[]): void {
    for (const k of keys) localStorage.removeItem(LS_PREFIX + k);
}

/**
 * The settings each demo actually reads. Anything absent from a demo's list is
 * dead weight in its debug panel, so the panel is mounted with the list rather
 * than with every key.
 *
 * VITE_PURSE_ENVIRONMENT is on every list: it selects the CDN the SDK is loaded
 * from, so it applies even to the demos that read nothing else.
 */
export const DEMO_ENV_KEYS = {
    // Drop-in and Headless Checkout are driven by a payment session.
    session: [
        'VITE_PURSE_ENVIRONMENT',
        'VITE_PURSE_SESSION_JSON',
    ],
    // Secure Fields tokenisation — tenant + api key, no session.
    secureFields: [
        'VITE_PURSE_ENVIRONMENT',
        'VITE_PURSE_SECUREFIELDS_TENANT_ID',
        'VITE_PURSE_API_KEY',
    ],
    // Advanced flow — Secure Fields plus the merchant backend (Alfred) and the
    // entity the v2 calls are scoped to.
    advancedFlow: [
        'VITE_PURSE_ENVIRONMENT',
        'VITE_PURSE_SECUREFIELDS_TENANT_ID',
        'VITE_PURSE_API_KEY',
        'VITE_PURSE_PROXY_URL',
        'VITE_PURSE_ENTITY_ID',
    ],
} as const satisfies Record<string, readonly EnvKey[]>;

export function isOverridden(key: EnvKey): boolean {
    return localStorage.getItem(LS_PREFIX + key) !== null;
}

export function getBuildDefault(key: EnvKey): string {
    return BUILD_DEFAULTS[key];
}

export function getEnvironment(): 'sandbox' | 'production' | undefined {
    return getEnv('VITE_PURSE_ENVIRONMENT') as 'sandbox' | 'production' | undefined;
}

// Secure Fields additionally supports a 'test' environment. The SDK's public
// `loadSecureFields` type only lists 'sandbox' | 'production', so callers must
// cast the result to the SDK's parameter type (see tokenize.ts).
export function getSecureFieldsEnvironment(): 'sandbox' | 'production' | 'test' | undefined {
    return getEnv('VITE_PURSE_ENVIRONMENT') as 'sandbox' | 'production' | 'test' | undefined;
}
