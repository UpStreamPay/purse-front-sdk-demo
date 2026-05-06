import { defineConfig } from 'tsup';
import { config } from 'dotenv';

config();

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['@codesandbox/sandpack-react', 'react', 'react-dom'],
  esbuildOptions(options) {
    options.define = {
      ...options.define,
      'process.env.VITE_PURSE_SESSION_URL': JSON.stringify(process.env.VITE_PURSE_SESSION_URL ?? ''),
      'process.env.VITE_SECUREFIELDS_TENANT_ID': JSON.stringify(process.env.VITE_SECUREFIELDS_TENANT_ID ?? ''),
      'process.env.VITE_SECUREFIELDS_LOGS_API_KEY': JSON.stringify(process.env.VITE_SECUREFIELDS_LOGS_API_KEY ?? ''),
    };
  },
});
