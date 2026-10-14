// After the build: minify the CSS inside the SDK's built stylesheets in dist/,
// as `boogyVite` does for a build against the source. One function does both
// (`dev/css-minify.ts`, built to dist-dev/).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { minifyCssLiterals } from '../dist-dev/css-minify.js';

const root = new URL('../dist/', import.meta.url).pathname;
let before = 0;
let after = 0;
for (const entry of readdirSync(root, { recursive: true })) {
  const path = join(root, String(entry));
  if (!/-css\.js$/.test(path)) continue;
  const code = readFileSync(path, 'utf8');
  const min = minifyCssLiterals(code);
  before += code.length;
  after += min.length;
  writeFileSync(path, min);
}
console.log(`minify-dist-css: ${before} -> ${after} bytes`);
