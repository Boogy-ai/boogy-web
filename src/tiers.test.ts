// The SDK holds only building blocks any Boogy Preact app would reuse, so no
// SDK component carries a domain word (app, pane, module, install) in an
// identifier. App-specific components live in the app that uses them.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const files = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((f) => {
    const p = join(dir, f);
    return statSync(join(root, p)).isDirectory() ? files(p) : [p];
  });
const primitives = [
  ...files('src/components'),
  ...readdirSync(join(root, 'preact')).filter((f) => /\.tsx?$/.test(f)).map((f) => `preact/${f}`),
].filter((f) => !/\.test\.tsx?$/.test(f));

describe('tiers', () => {
  it('no primitive names a domain in an identifier', () => {
    // Every identifier, split into its words (camelCase, PascalCase,
    // snake_case): `pane`, `paneId`, `AppRow`, `installFlow` all count.
    const DOMAIN = new Set(['app', 'apps', 'pane', 'panes', 'module', 'modules', 'install', 'installs', 'installed', 'installing']);
    const code = (f: string) => readFileSync(join(root, f), 'utf8')
      .replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')
      .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, '""');
    const words = (id: string) => id.split(/_|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/).map((w) => w.toLowerCase());
    const bad = primitives.flatMap((f) =>
      [...new Set(code(f).match(/[A-Za-z_$][\w$]*/g) ?? [])]
        .filter((id) => words(id).some((w) => DOMAIN.has(w)))
        .map((id) => `${f}: ${id}`));
    expect(bad).toEqual([]);
  });
});
