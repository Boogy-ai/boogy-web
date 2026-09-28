// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// A Vite config is loaded by plain Node, which resolves only exact file paths
// in ESM. The BUILT dev entry must therefore load without a bundler.
describe('@boogy/web/dev as built', () => {
  it('loads under plain Node and exports boogyDev', () => {
    const root = join(__dirname, '..');
    execFileSync(join(root, 'node_modules/typescript/bin/tsc'), ['-p', join(root, 'dev/tsconfig.json')]);
    const out = execFileSync(
      process.execPath,
      ['--input-type=module', '-e', `const m = await import(${JSON.stringify(join(root, 'dist-dev/index.js'))}); console.log(typeof m.boogyDev);`],
      { encoding: 'utf8' },
    );
    expect(out.trim()).toBe('function');
  }, 60_000);
});
