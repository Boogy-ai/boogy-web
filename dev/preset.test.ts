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
