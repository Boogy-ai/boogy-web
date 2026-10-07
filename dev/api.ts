import type { DevUser } from './fake-platform.js';

export type MockHandler = (ctx: {
  user: DevUser | null;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}) => { status?: number; body?: unknown } | Promise<{ status?: number; body?: unknown }>;

export type ApiMode =
  | { mode: 'proxy'; target: string; host: string; token?: string }
  | { mode: 'mock'; handlers: Record<string, MockHandler> };

/** Match `"GET /boards/:id"`-style keys against a method and an API path relative to the app's root. */
export function matchMock(
  handlers: Record<string, MockHandler>,
  method: string,
  path: string,
): { handler: MockHandler; params: Record<string, string> } | null {
  const parts = path.split('/').filter(Boolean);
  for (const [key, handler] of Object.entries(handlers)) {
    const [m, pattern] = key.split(' ');
    if (m !== method) continue;
    const pp = pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (pp[i] !== parts[i]) { ok = false; break; }
    }
    if (ok) return { handler, params };
  }
  return null;
}
