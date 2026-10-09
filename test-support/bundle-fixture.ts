// Bundle a browser-test fixture (Preact and the SDK, as an app ships them)
// into one script a test page can evaluate.
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

export async function bundleFixture(entry: string, name: string): Promise<string> {
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    root: fileURLToPath(new URL('..', import.meta.url)),
    resolve: { alias: [{ find: /^@boogy\/web$/, replacement: fileURLToPath(new URL('../src/index.ts', import.meta.url)) }] },
    oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL(entry, import.meta.url)), formats: ['iife'], name } },
  });
  const result = Array.isArray(out) ? out[0] : out;
  const chunk = (result as { output: { type: string; code?: string }[] }).output.find((o) => o.type === 'chunk');
  return chunk!.code!;
}
