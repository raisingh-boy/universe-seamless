import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  base: mode === 'github' ? '/universe-seamless/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : undefined,
  },
  preview: {
    host: "0.0.0.0",
    port: 5183,
    allowedHosts: ["universe.seamless.club", "universe.158-220-125-28.nip.io"],
  },
}));
