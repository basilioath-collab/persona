import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const repo = new URL('../', import.meta.url);
// An explicit allowlist prevents personal JSON files from entering the installer.
const personaFiles = ['index.html', 'shared/today.js', 'shared/desktop.js', 'manifest.webmanifest', 'icons/persona.svg', 'icons/persona-maskable.svg'];
function personaApp() {
  return {
    name: 'bundled-persona',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = req.url?.split('?')[0].replace(/^\/persona\//, '');
        if (!req.url?.startsWith('/persona/') || !personaFiles.includes(file)) return next();
        res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/manifest+json');
        res.end(readFileSync(new URL(file, repo)));
      });
    },
    generateBundle() {
      for (const file of personaFiles) this.emitFile({ type: 'asset', fileName: `persona/${file}`, source: readFileSync(new URL(file, repo)) });
    },
  };
}
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [personaApp()],
  server: { host: '0.0.0.0', port: 1420, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
