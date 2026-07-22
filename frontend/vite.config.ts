import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [
    react(),
    mkcert(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "homeStock",
        short_name: "homeStock",
        start_url: "/",
        display: "standalone",
        background_color: "#f7f9fb",
        theme_color: "#006e2f",
        icons: [],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
