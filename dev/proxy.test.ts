// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer as createHttpServer, type Server } from 'node:http';
import { createServer, type ViteDevServer } from 'vite';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boogyDev, type BoogyDevOptions } from './plugin.js';

// The proxy must present the TENANT host to the platform: the host resolves the
// owner from the Host header, so a proxied request carrying the dev server's
// own host reaches no tenant at all.
let upstream: Server;
let seen: { host?: string; auth?: string; url?: string; body?: string } = {};
let vite: ViteDevServer;
let base: string;

beforeAll(async () => {
  upstream = createHttpServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen = { host: req.headers.host, auth: req.headers.authorization, url: req.url, body };
      res.setHeader('content-type', 'application/json');
      res.end('{"ok":true}');
    });
  });
  await new Promise<void>((r) => upstream.listen(0, r));
  const port = (upstream.address() as { port: number }).port;
  const root = mkdtempSync(join(tmpdir(), 'boogy-proxy-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><html><body></body></html>');
  vite = await createServer({
    root, logLevel: 'silent', server: { port: 0 },
    plugins: [boogyDev({
      owner: 'tester', service: 'boards', users: [],
      api: { mode: 'proxy', target: `http://127.0.0.1:${port}`, host: 'boards.local.boogy.app', token: 'tok' },
    })],
  });
  await vite.listen();
  base = `http://localhost:${(vite.httpServer!.address() as { port: number }).port}`;
});

afterAll(async () => {
  await vite.close();
  upstream.close();
});

describe('proxy mode', () => {
  it('presents the tenant host, the bearer, and the path the app sent, at the root of its address', async () => {
    const r = await fetch(`${base}/api/boards?x=1`);
    expect(await r.json()).toEqual({ ok: true });
    expect(seen.host).toBe('boards.local.boogy.app');
    expect(seen.auth).toBe('Bearer tok');
    expect(seen.url).toBe('/api/boards?x=1');
  });

  // There is no mount to configure: every app is served at the root of its
  // own address. A config written before that, which still names one, is not
  // obeyed — the request goes upstream at the path the app sent.
  it('takes no mount: an old config naming one still sends the path the app sent', async () => {
    const root = mkdtempSync(join(tmpdir(), 'boogy-proxy-root-'));
    writeFileSync(join(root, 'index.html'), '<!doctype html><html><body></body></html>');
    const port = (upstream.address() as { port: number }).port;
    const legacy = { owner: 'tester', service: 'boards', mount: '/boards', users: [],
      api: { mode: 'proxy', target: `http://127.0.0.1:${port}`, host: 'boards.local.boogy.app' } } as unknown as BoogyDevOptions;
    const v = await createServer({ root, logLevel: 'silent', server: { port: 0 }, plugins: [boogyDev(legacy)] });
    await v.listen();
    const b = `http://localhost:${(v.httpServer!.address() as { port: number }).port}`;
    await fetch(`${b}/api/boards`);
    await v.close();
    expect(seen.url).toBe('/api/boards');
  });

  it('forwards a request body', async () => {
    await fetch(`${base}/api/boards`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' });
    expect(seen.body).toBe('{"a":1}');
  });

  it('fetches a listing thumbnail from the platform at its own path, without the bearer', async () => {
    const r = await fetch(`${base}/boogy/thumbnails/${'a'.repeat(64)}`);
    expect(r.status).toBe(200);
    expect(seen.url).toBe(`/boogy/thumbnails/${'a'.repeat(64)}`);
    expect(seen.host).toBe('boards.local.boogy.app');
    expect(seen.auth).toBeUndefined();
  });
});
