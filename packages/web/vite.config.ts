import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// In dev, the UI runs on Vite's port and talks to the Tabledux server on 8080.
export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
});
