import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "0.0.0.0", port: 5173 },
  preview: {
    host: "0.0.0.0",
    port: 5183,
    allowedHosts: ["universe.seamless.club", "universe.158-220-125-28.nip.io"],
  },
});
