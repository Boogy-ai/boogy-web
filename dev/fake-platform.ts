// A local stand-in for the platform endpoints the SDK talks to, so an app can
// run under a dev server with sign-in that never leaves localhost. It fakes the
// HTTP contract, not the SDK, so the SDK's real sign-in code runs unchanged.
import { randomBytes } from 'node:crypto';
import { verifyS256 } from './pkce.js';

export interface DevUser { id: string; displayName?: string }
export interface FakePlatformOptions {
  owner: string;
  service: string;
  users: DevUser[];
  /** Where the platform console lives, as `/boogy/config` reports it. Omitted
   *  from the config when unset, as the platform omits it. */
  consoleOrigin?: string;
}
export type FailureMode = 'slow' | '401' | '500' | 'offline';
export interface FakeRequest { method: string; url: string; headers: Record<string, string | undefined>; body?: string }
export interface FakeResponse { status: number; headers: Record<string, string | string[]>; body: string; offline?: boolean }
export interface FakePlatform {
  handle(req: FakeRequest): Promise<FakeResponse | null>;
  setFailure(endpoint: string, mode: FailureMode | null): void;
  currentUser(req: FakeRequest): DevUser | null;
}

export const AUTH_PREFIX = '/__boogy/auth';
export const SESSION_COOKIE = 'boogy_dev_session';
const SLOW_MS = 2000;

interface PendingCode { user: DevUser; state: string; challenge: string; redirect: string; mode: string; appOrigin: string }

const jsonRes = (status: number, value: unknown, headers: Record<string, string | string[]> = {}): FakeResponse => ({
  status, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(value),
});
const htmlRes = (status: number, body: string, headers: Record<string, string | string[]> = {}): FakeResponse => ({
  status, headers: { 'content-type': 'text/html; charset=utf-8', ...headers }, body,
});
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function cookie(req: FakeRequest, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

export function createFakePlatform(opts: FakePlatformOptions): FakePlatform {
  const codes = new Map<string, PendingCode>();
  const failures = new Map<string, FailureMode>();
  const connectedAt = new Date().toISOString();
  const originOf = (req: FakeRequest) => `http://${req.headers.host ?? 'localhost'}`;
  const userById = (id: string | undefined) => opts.users.find((u) => u.id === id) ?? null;
  const currentUser = (req: FakeRequest) => userById(cookie(req, SESSION_COOKIE));
  const sessionCookie = (id: string) => `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax`;
  const clearSession = `${SESSION_COOKIE}=; Path=/; Max-Age=0`;

  function route(req: FakeRequest): { key: string; run: () => FakeResponse } | null {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname;
    const origin = originOf(req);
    const auth = `${origin}${AUTH_PREFIX}`;

    if (req.method === 'GET' && path === '/boogy/config') {
      return {
        key: 'config',
        run: () => jsonRes(200, {
          authOrigin: auth, owner: opts.owner, shellOrigins: [],
          ...(opts.consoleOrigin ? { consoleOrigin: opts.consoleOrigin } : {}),
        }),
      };
    }
    if (req.method === 'GET' && path === '/boogy/me') {
      return {
        key: 'me',
        run: () => {
          const u = currentUser(req);
          return jsonRes(200, u ? { pairwiseId: `dev-${u.id}`, services: [opts.service], connectedAt, displayName: u.displayName ?? u.id, avatarUrl: null } : null);
        },
      };
    }
    if (req.method === 'POST' && path === '/boogy/logout') {
      return { key: 'logout', run: () => jsonRes(200, { signedOut: 'origin' }, { 'set-cookie': clearSession }) };
    }
    if (req.method === 'GET' && path === `${AUTH_PREFIX}/authorize`) {
      return {
        key: 'authorize',
        run: () => {
          const items = opts.users
            .map((u) => {
              const q = new URLSearchParams(url.searchParams);
              q.set('user', u.id);
              return `<li><a href="${AUTH_PREFIX}/authorize/pick?${escapeHtml(q.toString())}">${escapeHtml(u.displayName ?? u.id)}</a></li>`;
            })
            .join('');
          return htmlRes(200, `<!doctype html><meta charset="utf-8"><title>Sign in (dev)</title><h1>Sign in as a test user</h1><ul>${items}</ul>`);
        },
      };
    }
    if (req.method === 'GET' && path === `${AUTH_PREFIX}/authorize/pick`) {
      return {
        key: 'authorize',
        run: () => {
          const p = url.searchParams;
          const user = userById(p.get('user') ?? undefined);
          const appOrigin = p.get('app_origin') ?? origin;
          const redirect = p.get('redirect') ?? '/';
          // Sign-in never leaves the dev server's own origin.
          if (!user || appOrigin !== origin || !redirect.startsWith('/') || redirect.startsWith('//')) {
            return htmlRes(400, 'invalid sign-in request');
          }
          const code = randomBytes(16).toString('hex');
          codes.set(code, { user, state: p.get('state') ?? '', challenge: p.get('code_challenge') ?? '', redirect, mode: p.get('mode') ?? 'redirect', appOrigin });
          const q = new URLSearchParams({ code, state: p.get('state') ?? '' });
          return { status: 302, headers: { location: `${origin}/boogy/callback?${q}` }, body: '' };
        },
      };
    }
    if (req.method === 'GET' && path === '/boogy/callback') {
      return {
        key: 'callback',
        run: () => {
          const code = url.searchParams.get('code') ?? '';
          const pending = codes.get(code);
          codes.delete(code); // single use, consumed before any other decision
          const verifier = cookie(req, '__Host-boogy_pkce');
          if (!pending || pending.state !== url.searchParams.get('state') || !verifier || !verifyS256(verifier, pending.challenge)) {
            return htmlRes(400, 'sign-in could not be completed');
          }
          const setCookie = [sessionCookie(pending.user.id), '__Host-boogy_pkce=; Secure; SameSite=Lax; Path=/; Max-Age=0'];
          if (pending.mode === 'popup') {
            return htmlRes(200, `<!doctype html><script>try{if(window.opener){window.opener.postMessage({ boogy: "sso_done" }, ${JSON.stringify(pending.appOrigin)});}}catch(e){}window.close();</script>You can close this window.`, { 'set-cookie': setCookie });
          }
          return { status: 302, headers: { location: pending.redirect, 'set-cookie': setCookie }, body: '' };
        },
      };
    }
    if (req.method === 'POST' && path === `${AUTH_PREFIX}/_agents/logout`) {
      return { key: 'agents-logout', run: () => jsonRes(200, {}, { 'set-cookie': clearSession }) };
    }
    if (path === `${AUTH_PREFIX}/_agents/grants` && req.method === 'GET') {
      return { key: 'grants', run: () => (currentUser(req) ? jsonRes(200, [{ app: `${opts.owner}/${opts.service}`, connectedAt }]) : jsonRes(401, { error: 'unauthenticated' })) };
    }
    if (path.startsWith(`${AUTH_PREFIX}/_agents/grants/`) && req.method === 'DELETE') {
      return { key: 'grants', run: () => ({ status: 204, headers: {}, body: '' }) };
    }
    return null;
  }

  return {
    currentUser,
    setFailure(endpoint, mode) {
      if (mode) failures.set(endpoint, mode);
      else failures.delete(endpoint);
    },
    async handle(req) {
      const r = route(req);
      if (!r) return null;
      const failure = failures.get(r.key);
      if (failure === 'offline') return { status: 0, headers: {}, body: '', offline: true };
      if (failure === '401') return jsonRes(401, { error: 'unauthenticated' });
      if (failure === '500') return jsonRes(500, { error: 'internal' });
      if (failure === 'slow') await new Promise((res) => setTimeout(res, SLOW_MS));
      return r.run();
    },
  };
}
