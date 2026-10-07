import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Relative base so the production build works from any sub-directory
// (GitHub Pages serves the site from /<repository-name>/).
export default defineConfig({
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: true, port: 5173, strictPort: false, hmr: process.env.BB_NO_HMR ? false : undefined },
  preview: { port: 4173 },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        advancedChunks: { groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
