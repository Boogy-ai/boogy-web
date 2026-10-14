// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolveConfig } from 'vite';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boogyVite } from './preset.js';

const dev = { owner: 'me', service: 'app', users: [] };

describe('boogyVite', () => {
  it('sets relative asset paths, so the platform can serve the build wherever it is served', async () => {
    const root = mkdtempSync(join(tmpdir(), 'boogy-preset-'));
    const cfg = await resolveConfig({ root, plugins: [...boogyVite(dev)] }, 'build');
    expect(cfg.base).toBe('./');
  });

  it('includes the dev platform', () => {
    expect(boogyVite(dev).map((p) => p.name)).toContain('boogy-dev');
  });

  it('lets the app override the base explicitly', async () => {
    const root = mkdtempSync(join(tmpdir(), 'boogy-preset-'));
    const cfg = await resolveConfig({ root, base: '/fixed/', plugins: [...boogyVite(dev)] }, 'build');
    expect(cfg.base).toBe('/fixed/');
  });
});

describe("boogyVite minifies the SDK's CSS in a build", () => {
  const plugin = () => boogyVite(dev).find((p) => p.name === 'boogy-sdk-css')!;
  type Transform = (code: string, id: string) => { code: string } | null | undefined;

  it('only in a build, and only for the SDK\'s CSS modules', () => {
    const p = plugin();
    expect(p.apply).toBe('build');
    const t = p.transform as unknown as Transform;
    const css = 'export const A = `\n  /* a note */\n  a { color: red; }\n`;';
    expect(t(css, '/repo/packages/web-sdk/src/layout/foundation-css.ts')!.code).toBe('export const A = `a{color: red;}`;');
    expect(t(css, '/app/web/main.ts')).toBeNull();
  });
});
