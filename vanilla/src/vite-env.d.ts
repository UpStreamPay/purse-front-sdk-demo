/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ── Headless Checkout / Drop-in ─────────────────────────────────────────────
  readonly VITE_PURSE_API_KEY: string;
  readonly VITE_PURSE_ENTITY_ID: string;
  readonly VITE_PURSE_SESSION_JSON: string;

  // ── Secure Fields ────────────────────────────────────────────────────────────
  readonly VITE_PURSE_SECUREFIELDS_TENANT_ID: string;

  // ── Environment (optional) ──────────────────────────────────────────────────
  readonly VITE_PURSE_ENVIRONMENT: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
