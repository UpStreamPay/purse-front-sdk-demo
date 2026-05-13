import { defineConfig } from 'tsup';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

config();

const rawPlugin = {
  name: 'raw',
  setup(build: any) {
    build.onResolve({ filter: /\?raw$/ }, (args: any) => ({
      path: resolve(args.resolveDir, args.path.replace(/\?raw$/, '')),
      namespace: 'raw-file',
    }));
    build.onLoad({ filter: /.*/, namespace: 'raw-file' }, (args: any) => ({
      contents: `export default ${JSON.stringify(readFileSync(args.path, 'utf8'))}`,
      loader: 'js',
    }));
  },
};

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['@codesandbox/sandpack-react', 'react', 'react-dom'],
  esbuildPlugins: [rawPlugin],
  esbuildOptions(options) {
    options.define = {
      ...options.define,
      'process.env.VITE_PURSE_SESSION_URL': JSON.stringify(process.env.VITE_PURSE_SESSION_URL ?? ''),
      'process.env.VITE_SECUREFIELDS_TENANT_ID': JSON.stringify(process.env.VITE_SECUREFIELDS_TENANT_ID ?? ''),
      'process.env.VITE_SECUREFIELDS_LOGS_API_KEY': JSON.stringify(process.env.VITE_SECUREFIELDS_LOGS_API_KEY ?? ''),
    };
  },
});
