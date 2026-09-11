import { getEnv, type EnvKey } from '@shared/env';

export type SecureFieldsEnvironment = 'sandbox' | 'production' | 'test';

/**
 * Which Secure Fields build to load. `test` is accepted at runtime but absent
 * from the SDK's public types (see node_modules/@purse-eu/web-sdk/dist/SDKs.d.ts,
 * where only securefields has a `test` entry).
 */
export function secureFieldsEnvironment(): SecureFieldsEnvironment {
  return (getEnv('VITE_PURSE_ENVIRONMENT') || 'sandbox') as SecureFieldsEnvironment;
}

/**
 * The 3DS versioning + fingerprint chain ships only in the `test` Secure Fields
 * build — `cdn.purse-sandbox.com` has no `/3ds/versioning` call and never
 * returns a threeDSServerTransID. Anywhere else the page still runs, but the
 * 3DS steps have nothing to observe, so say so rather than let it look broken.
 */
export function threeDSSupported(): boolean {
  return secureFieldsEnvironment() === 'test';
}

/** The settings this page reads — what the debug panel shows. */
export const SHOWCASE_ENV_KEYS = [
  'VITE_PURSE_ENVIRONMENT',
  'VITE_PURSE_SECUREFIELDS_TENANT_ID',
  'VITE_PURSE_API_KEY',
  'VITE_PURSE_PROXY_URL',
  'VITE_PURSE_ENTITY_ID',
] as const satisfies readonly EnvKey[];
