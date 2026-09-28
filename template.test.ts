import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, 'template');
const files: string[] = [];
(function walk(d: string) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(root);

describe('template', () => {
  it('has a common layer and both build modes', () => {
    const top = new Set(files.map((f) => f.slice(root.length + 1).split('/')[0]));
    expect([...top].sort()).toEqual(['common', 'dist', 'source']);
  });

  it('uses only the placeholders boogy new fills', () => {
    for (const f of files) {
      for (const m of (f + readFileSync(f, 'utf8')).matchAll(/\{\{(\w+)\}\}/g)) {
        expect(['name', 'sdk_version', 'src'], `${f}: {{${m[1]}}}`).toContain(m[1]);
      }
    }
  });

  it('references the transpiled app.js, never .ts, in the source-mode page', () => {
    const html = readFileSync(join(root, 'source/web/index.html'), 'utf8');
    expect(html).toContain('src="./app.js"');
    expect(html).not.toMatch(/src="[^"]+\.tsx?"/);
  });
});
