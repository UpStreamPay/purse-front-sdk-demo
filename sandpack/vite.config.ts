import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.VITE_PURSE_SESSION_URL': JSON.stringify(env.VITE_PURSE_SESSION_URL ?? ''),
      'process.env.VITE_SECUREFIELDS_TENANT_ID': JSON.stringify(env.VITE_SECUREFIELDS_TENANT_ID ?? ''),
      'process.env.VITE_SECUREFIELDS_LOGS_API_KEY': JSON.stringify(env.VITE_SECUREFIELDS_LOGS_API_KEY ?? ''),
    },
  };
});
