import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// A relative base works at both / and /imagination-atelier/. Hash links avoid server rewrites.
export default defineConfig({
  base: process.env.PAGES_BASE_PATH || './',
  plugins: [react(), tailwindcss()],
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 850 },
});
