import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const api = process.env["API_URL"] ?? "http://127.0.0.1:3000";

// Lokalnie Vite przekazuje /api i /health do API, żeby web i API miały jeden origin (ADR 0006).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: api, ws: true },
      "/health": { target: api },
    },
  },
});
