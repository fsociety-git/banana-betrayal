import { defineConfig, type Plugin } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

/** The viewport harness lives outside `public/` so it is never published; the dev server serves it at /dev/frame.html. */
function devHarness(): Plugin {
  return {
    name: 'bb-dev-harness',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/dev/frame.html') { next(); return; }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(readFileSync(fileURLToPath(new URL('./dev/frame.html', import.meta.url))));
      });
    },
  };
}

// Relative base so the production build works from any sub-directory
// (GitHub Pages serves the site from /<repository-name>/).
export default defineConfig({
  base: './',
  plugins: [devHarness()],
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
        codeSplitting: { groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
