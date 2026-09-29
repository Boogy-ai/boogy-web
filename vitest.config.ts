import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  resolve: {
    // The Preact entry imports the core by the package's own name, as a consumer does.
    alias: [
      { find: /^@boogy\/web\/catalog$/, replacement: fileURLToPath(new URL('./src/patterns/catalog/index.ts', import.meta.url)) },
      { find: /^@boogy\/web$/, replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
    ],
  },
  test: {
    environment: 'happy-dom',
    exclude: ['test-browser/**', 'node_modules/**', 'dist/**', 'dist-dev/**', 'dist-preact/**'],
  },
});
