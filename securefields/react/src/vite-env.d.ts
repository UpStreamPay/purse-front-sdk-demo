interface ViteTypeOptions {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  // strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_PURSE_TENANT_ID: string;
  readonly VITE_PURSE_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
