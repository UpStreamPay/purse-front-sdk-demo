import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  envDir: '../',
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        'dropin-widget': resolve(__dirname, 'dropin/widget.html'),
        'headless-render-methods': resolve(__dirname, 'headless-checkout/render-methods.html'),
        'headless-hosted-form': resolve(__dirname, 'headless-checkout/hosted-form.html'),
        'headless-hosted-fields': resolve(__dirname, 'headless-checkout/hosted-fields.html'),
        'securefields-tokenize': resolve(__dirname, 'securefields/tokenize.html'),
      },
    },
  },
});
