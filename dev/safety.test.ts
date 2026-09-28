// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer as createHttpServer, type Server } from 'node:http';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boogyDev } from './plugin.js';

let upstream: Server;
let upstreamHits = 0;
let vite: ViteDevServer;
let base: string;

// Another app middleware, registered after boogyDev, that needs the body.
const echo: Plugin = {
  name: 'echo',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/echo') return next();
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => res.end(`got:${b}`));
    });
  },
};

beforeAll(async () => {
  upstream = createHttpServer((_req, res) => { upstreamHits++; res.end('{}'); });
  await new Promise<void>((r) => upstream.listen(0, r));
  const port = (upstream.address() as { port: number }).port;
  const root = mkdtempSync(join(tmpdir(), 'boogy-safety-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><html><body></body></html>');
  vite = await createServer({
    root, logLevel: 'silent', server: { port: 0 },
    plugins: [
      boogyDev({ owner: 'o', service: 's', mount: '/s', users: [],
        api: { mode: 'proxy', target: `http://127.0.0.1:${port}`, host: 'o.example', token: 'real' } }),
      echo,
    ],
  });
  await vite.listen();
  base = `http://localhost:${(vite.httpServer!.address() as { port: number }).port}`;
});

afterAll(async () => {
  await vite.close();
  upstream.close();
});

describe('the dev proxy carries a real token, so a foreign page must not reach it', () => {
  it('refuses a cross-site request before it reaches the real service', async () => {
    const before = upstreamHits;
    const r = await fetch(`${base}/api/x`, { method: 'POST', body: 'a=1', headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' } });
    expect(r.status).toBe(403);
    expect(upstreamHits).toBe(before);
  });

  it('refuses a foreign Origin even without Sec-Fetch-Site', async () => {
    const before = upstreamHits;
    const r = await fetch(`${base}/api/x`, { method: 'POST', body: 'a=1', headers: { origin: 'https://evil.example' } });
    expect(r.status).toBe(403);
    expect(upstreamHits).toBe(before);
  });

  it('lets the dev page itself through', async () => {
    const before = upstreamHits;
    const r = await fetch(`${base}/api/x`, { method: 'POST', body: '{}', headers: { 'sec-fetch-site': 'same-origin', origin: base } });
    expect(r.status).toBe(200);
    expect(upstreamHits).toBe(before + 1);
  });
});

describe('bodies it does not own', () => {
  it('leaves a POST body intact for a later middleware', async () => {
    const r = await fetch(`${base}/echo`, { method: 'POST', body: 'hello' });
    expect(await r.text()).toBe('got:hello');
  });
});
