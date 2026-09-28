// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boogyDev } from './plugin';

let server: ViteDevServer;
let base: string;

beforeAll(async () => {
  const root = mkdtempSync(join(tmpdir(), 'boogy-dev-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><html><head></head><body><div id="app"></div></body></html>');
  server = await createServer({
    root,
    logLevel: 'silent',
    server: { port: 0 },
    plugins: [
      boogyDev({
        owner: 'tester', service: 'boards', mount: '/boards', apiPrefix: '/api',
        users: [{ id: 'alice' }],
        api: { mode: 'mock', handlers: { 'GET /boards': ({ user }) => ({ body: { who: user?.id ?? null } }) } },
      }),
    ],
  });
  await server.listen();
  const addr = server.httpServer!.address() as { port: number };
  base = `http://localhost:${addr.port}`;
});

afterAll(async () => {
  await server.close();
});

describe('boogyDev plugin', () => {
  it('serves the fake platform', async () => {
    const r = await fetch(`${base}/boogy/config`);
    expect((await r.json()).owner).toBe('tester');
  });

  // The dev server serves the app at its root, so the app's relative `./api/...`
  // calls arrive at `/api/...` whatever the deployed mount is.
  it('routes the app API to mock handlers with the picked user', async () => {
    const anon = await fetch(`${base}/api/boards`);
    expect(await anon.json()).toEqual({ who: null });
    const login = await fetch(`${base}/__boogy/dev/login?user=alice&to=/`, { redirect: 'manual' });
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const signed = await fetch(`${base}/api/boards`, { headers: { cookie } });
    expect(await signed.json()).toEqual({ who: 'alice' });
  });

  it('404s an unmatched API path instead of falling through to the SPA shell', async () => {
    const r = await fetch(`${base}/api/nope`);
    expect(r.status).toBe(404);
  });

  it('injects <base href="/"> first in <head>, as the platform injects its base in production', async () => {
    // Without it a deep route (/b/x) resolves the app's relative ./api/... to
    // /b/api/... and gets the page instead of the API.
    const html = await (await fetch(`${base}/b/deep`)).text();
    expect(html).toMatch(/<head>\s*<base href="\/">/);
  });

  it('injects the dev badge into the served page', async () => {
    const html = await (await fetch(`${base}/`)).text();
    expect(html).toContain('/__boogy/dev/badge.js');
  });

  it('serves the SDK typefaces at the platform path, like the host', async () => {
    const r = await fetch(`${base}/boogy/fonts/figtree-latin-wght-5.3.0.woff2`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('font/woff2');
    expect(Buffer.from(await r.arrayBuffer()).subarray(0, 4).toString()).toBe('wOF2');
    expect((await fetch(`${base}/boogy/fonts/nope.woff2`)).status).toBe(404);
    expect((await fetch(`${base}/boogy/fonts/..%2Fpackage.json`)).status).toBe(404);
  });

  it('toggles an endpoint failure over HTTP', async () => {
    await fetch(`${base}/__boogy/dev/failures`, { method: 'POST', body: JSON.stringify({ endpoint: 'config', mode: '500' }) });
    expect((await fetch(`${base}/boogy/config`)).status).toBe(500);
    await fetch(`${base}/__boogy/dev/failures`, { method: 'POST', body: JSON.stringify({ endpoint: 'config', mode: null }) });
    expect((await fetch(`${base}/boogy/config`)).status).toBe(200);
  });
});
