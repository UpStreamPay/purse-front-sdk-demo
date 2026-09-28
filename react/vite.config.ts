import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  envDir: "../",
  server: { port: Number(process.env.PORT) || 5173 },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        securefields: resolve(__dirname, "securefields/index.html"),
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
