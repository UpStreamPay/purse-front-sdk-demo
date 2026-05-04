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
    };
  },
});
