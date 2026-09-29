
interface ImportMetaEnv {
  readonly VITE_PURSE_SECUREFIELDS_TENANT_ID: string;
  readonly VITE_PURSE_API_KEY: string;
  readonly VITE_PURSE_ENVIRONMENT: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
