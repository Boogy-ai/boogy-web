import type { Plugin } from 'vite';
import { request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createFakePlatform, SESSION_COOKIE, type DevUser, type FakeRequest, type FakeResponse } from './fake-platform.js';
import { matchMock, type ApiMode } from './api.js';
import { BADGE_JS } from './badge.js';
import { readFile } from 'node:fs/promises';

// The SDK's typefaces, served where the platform serves them (/boogy/fonts/),
// from the package's own fonts/ directory: ../fonts from dev/ and dist-dev/ alike.
const FONTS_DIR = new URL('../fonts/', import.meta.url);
// A bare file name: no slash, no dot-dot, so nothing outside fonts/ is reachable.
const FONT_NAME = /^[a-z0-9-]+(?:\.[0-9]+)*\.woff2$/;

export interface BoogyDevOptions {
  owner: string;
  service: string;
  /** Where the app is deployed, e.g. "/boards", or "/" for an app served at
   *  its origin's root. Used to build the upstream path when proxying. */
  mount: string;
  /** API subtree relative to the mount (and, in dev, to the dev server's
   *  root). Default "/api". */
  apiPrefix?: string;
  users: DevUser[];
  /** Where the platform console lives; the fake `/boogy/config` reports it,
   *  so an app's install flow can open it in dev. */
  consoleOrigin?: string;
  api?: ApiMode;
}

/**
 * Forward one request to the real platform. `node:http` rather than `fetch`:
 * fetch silently drops a caller-set `Host`, and the platform resolves the
 * tenant from `Host`, so a fetch-proxied request reaches no tenant at all.
 */
function proxy(
  api: Extract<ApiMode, { mode: 'proxy' }>,
  freq: FakeRequest,
  url: string,
  body: string | undefined,
  res: ServerResponse,
  /** Attach the real account's bearer. Off for public platform routes, which
   *  need no credential and must not be handed one. */
  withToken = true,
): Promise<void> {
  const target = new URL(url, api.target);
  const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const up = send(
      target,
      {
        method: freq.method,
        headers: {
          host: api.host,
          'content-type': String(freq.headers['content-type'] ?? 'application/json'),
          ...(body ? { 'content-length': String(Buffer.byteLength(body)) } : {}),
          ...(api.token && withToken ? { authorization: `Bearer ${api.token}` } : {}),
        },
      },
      (upRes) => {
        res.statusCode = upRes.statusCode ?? 502;
        for (const [k, v] of Object.entries(upRes.headers)) {
          if (v !== undefined && k !== 'transfer-encoding' && k !== 'connection') res.setHeader(k, v);
        }
        upRes.pipe(res);
        upRes.on('end', resolve);
      },
    );
    up.on('error', reject);
    if (body) up.write(body);
    up.end();
  });
}

/** A request a page on another site could have sent: the browser says so
 *  (`Sec-Fetch-Site`), or it names an `Origin` other than this dev server. */
function isForeign(req: IncomingMessage): boolean {
  const site = req.headers['sec-fetch-site'];
  if (site === 'cross-site' || site === 'same-site') return true;
  const origin = req.headers.origin;
  return origin !== undefined && origin !== `http://${req.headers.host}`;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

function send(res: ServerResponse, r: FakeResponse): void {
  if (r.offline) { res.socket?.destroy(); return; }
  res.statusCode = r.status;
  for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
  res.end(r.body);
}

export function boogyDev(opts: BoogyDevOptions): Plugin {
  const fake = createFakePlatform({ owner: opts.owner, service: opts.service, users: opts.users, consoleOrigin: opts.consoleOrigin });
  // The dev server serves the app at ITS root, so the app's relative
  // `./api/...` calls arrive at `<apiPrefix>/...` here whatever the deployed
  // mount is. The mount only matters upstream, when proxying.
  const apiBase = opts.apiPrefix ?? '/api';
  const mount = opts.mount === '/' ? '' : opts.mount.replace(/\/$/, '');
  const badge = opts.api?.mode === 'proxy' ? BADGE_JS.replace("'dev: '", "'dev (API: real account): '") : BADGE_JS;

  return {
    name: 'boogy-dev',
    apply: 'serve',
    transformIndexHtml() {
      return [
        // The platform injects a <base href> into every document it serves, so
        // the app's relative URLs resolve from its mount at any route depth.
        // The dev server serves the app at its root; this is the same base.
        { tag: 'base', attrs: { href: '/' }, injectTo: 'head-prepend' },
        { tag: 'script', attrs: { type: 'module', src: '/__boogy/dev/badge.js' }, injectTo: 'body' },
      ];
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const url = req.url ?? '/';
          const path = url.split('?')[0];
          const isApi = path === apiBase || path.startsWith(`${apiBase}/`);
          // Only touch requests this plugin owns: reading a body consumes it,
          // and a later middleware (or Vite's own server.proxy) needs it intact.
          if (!isApi && !path.startsWith('/boogy/') && !path.startsWith('/__boogy/')) {
            next();
            return;
          }
          // The API is proxied with a REAL token, and the failure switches change
          // behaviour for everyone: a page on another site must not reach either.
          if ((isApi || path === '/__boogy/dev/failures') && isForeign(req)) {
            send(res, { status: 403, headers: {}, body: 'boogyDev: cross-site request refused' });
            return;
          }
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
          const freq: FakeRequest = { method: req.method ?? 'GET', url, headers: req.headers as Record<string, string | undefined>, body };

          if (path.startsWith('/boogy/fonts/') && (req.method === 'GET' || req.method === 'HEAD')) {
            const name = path.slice('/boogy/fonts/'.length);
            const bytes = FONT_NAME.test(name) ? await readFile(new URL(name, FONTS_DIR)).catch(() => null) : null;
            if (!bytes) { send(res, { status: 404, headers: {}, body: 'no such font' }); return; }
            res.setHeader('content-type', 'font/woff2');
            res.setHeader('cache-control', 'no-cache');
            res.end(req.method === 'HEAD' ? undefined : bytes);
            return;
          }
          // A registry listing's thumbnails are root-relative URLs on a public
          // platform route the host answers on every origin. In proxy mode they
          // come from the real platform — WITHOUT the bearer, which a public
          // image needs no more than a stranger's browser has it; in mock mode
          // there is no platform, so there are no thumbnails.
          if (path.startsWith('/boogy/thumbnails/') && (req.method === 'GET' || req.method === 'HEAD')) {
            const api = opts.api;
            if (api?.mode === 'proxy') { await proxy(api, freq, url, undefined, res, false); return; }
            send(res, { status: 404, headers: {}, body: 'boogyDev: thumbnails come from the platform (api mode "proxy")' });
            return;
          }
          if (path === '/__boogy/dev/badge.js') {
            res.setHeader('content-type', 'text/javascript');
            res.end(badge);
            return;
          }
          if (path === '/__boogy/dev/users') {
            send(res, { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(opts.users) });
            return;
          }
          if (path === '/__boogy/dev/login') {
            const q = new URL(url, 'http://x').searchParams;
            const id = q.get('user') ?? '';
            const to = q.get('to') ?? '/';
            if (!opts.users.some((u) => u.id === id) || !to.startsWith('/') || to.startsWith('//')) {
              send(res, { status: 400, headers: {}, body: 'unknown user or unsafe return path' });
              return;
            }
            send(res, { status: 302, headers: { location: to, 'set-cookie': `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax` }, body: '' });
            return;
          }
          if (path === '/__boogy/dev/failures' && req.method === 'POST') {
            const { endpoint, mode } = JSON.parse(body ?? '{}');
            fake.setFailure(String(endpoint), mode ?? null);
            send(res, { status: 204, headers: {}, body: '' });
            return;
          }

          const platform = await fake.handle(freq);
          if (platform) { send(res, platform); return; }

          if (isApi) {
            const api = opts.api;
            if (!api) { send(res, { status: 501, headers: {}, body: 'boogyDev: no api mode configured' }); return; }
            if (api.mode === 'mock') {
              const rel = path.slice(apiBase.length) || '/';
              const m = matchMock(api.handlers, freq.method, rel);
              if (!m) { send(res, { status: 404, headers: { 'content-type': 'application/json' }, body: '{"error":"no mock"}' }); return; }
              const out = await m.handler({
                user: fake.currentUser(freq),
                params: m.params,
                query: new URL(url, 'http://x').searchParams,
                body: body ? JSON.parse(body) : undefined,
              });
              send(res, { status: out.status ?? 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(out.body ?? null) });
              return;
            }
            await proxy(api, freq, `${mount}${url}`, body, res);
            return;
          }
          next();
        } catch (err) {
          next(err as Error);
        }
      });
    },
  };
}
