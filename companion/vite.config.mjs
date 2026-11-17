import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { host: '0.0.0.0', port: 1420, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
