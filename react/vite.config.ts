import { defineConfig } from "vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  envDir: "../",
  resolve: {
    alias: {
      // The advanced-flow helpers (env resolution + the Payment API v2 proxy
      // calls) live in the vanilla workspace but are plain TS — no Lit, no DOM
      // components — so the 3DS showcase reuses them instead of duplicating
      // ~300 lines. See react/src/threeds/.
      "@shared": resolve(import.meta.dirname, "../vanilla/src/shared"),
    },
  },
  server: {
    // The alias above reaches outside this workspace, which Vite's dev server
    // blocks by default.
    fs: { allow: [resolve(import.meta.dirname, "..")] },
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        threeds: resolve(import.meta.dirname, "threeds.html"),
      },
    },
  },
  plugins: [
    tailwindcss(),

    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
  ],
});
