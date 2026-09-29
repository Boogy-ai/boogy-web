import { describe, it, expect, vi, afterEach, afterAll, beforeAll } from 'vitest';
import {
  parseApp,
  parseApps,
  baseFromHost,
  appOrigin,
  authOrigin,
  authorizeUrl,
  MAX_AUDIENCES,
  siteSignInUrl,
  siteSignOutUrl,
} from './urls';
import { loadPlatformConfig } from './platform-config';
import type { BoogyError } from '../errors';

// The `appOrigin`/`authOrigin`/`authorizeUrl` tests below use the STATIC
// top-level import above, so they share ONE platform-config instance for the
// whole file — seeded once here, before any test runs, with the same
// owner/authOrigin fixture every existing assertion already assumes
// ('alice' / 'https://auth.boogy.ai'). This is deliberately separate from
// the config-driven-origins block further down, which needs a DIFFERENT
// config per test and gets one via `vi.resetModules()` + a fresh dynamic
// import — that pattern would be overkill here, where every test wants the
// same fixture.
beforeAll(async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(
      JSON.stringify({ authOrigin: 'https://auth.boogy.ai', owner: 'alice', shellOrigins: [] }),
      { status: 200 },
    ),
  );
  await loadPlatformConfig();
  vi.restoreAllMocks();
});

// ─── Config-driven origins (task B3a) ──────────────────────────────────────
//
// `appOrigin`/`authOrigin`/`authorizeUrl` now read from the platform-config
// singleton (`./platform-config`) instead of taking a `base` string. Each
// test below needs a FRESH module graph — `platformConfig()`'s cache is
// module-scoped state, and a test that loaded config would otherwise leak
// into the next one. `vi.resetModules()` plus importing `./platform-config`
// and `./urls` together, in the same post-reset epoch, is what keeps both
// modules' single shared cache instance in sync with each other.
async function withLoadedConfig(config: {
  authOrigin: string;
  owner: string;
  shellOrigins?: string[];
}) {
  vi.resetModules();
  const { loadPlatformConfig } = await import('./platform-config');
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ shellOrigins: [], ...config }), { status: 200 }),
  );
  await loadPlatformConfig();
  vi.restoreAllMocks();
  return import('./urls');
}

describe('appOrigin / authOrigin — config-driven origins (decisions 1–3)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('own owner: appOrigin returns the PAGE origin, not a constructed one', async () => {
    vi.stubGlobal('location', { origin: 'https://alice.boogy.ai' });
    const urls = await withLoadedConfig({ authOrigin: 'https://auth.boogy.ai', owner: 'alice' });
    expect(urls.appOrigin('alice')).toBe('https://alice.boogy.ai');
  });

  // `/boogy/config` carries `owner`, `authOrigin` and `shellOrigins` — nothing
  // that names the tenant BASE domain. `authOrigin` is not reliably
  // `auth.<base>`: the host resolves it from `BOOGY_AUTH_ORIGIN`, which
  // accepts any absolute origin an operator sets, so stripping a leading
  // label off it to reconstruct a foreign owner's origin is a GUESS dressed
  // up as a derivation — the exact defect this slice exists to remove,
  // reintroduced in the one branch the local dev fake platform never
  // exercises (it serves same-owner sign-in only, so a wrong guess here
  // would ship green). So this throws instead: a cross-owner `appOrigin` is
  // UNSUPPORTED until `/boogy/config` grows an explicit base-domain field —
  // a host-side change, not made in this slice.
  it('foreign owner: appOrigin throws rather than guess a base domain — cross-owner origins are unsupported', async () => {
    vi.stubGlobal('location', { origin: 'https://alice.boogy.ai' });
    const urls = await withLoadedConfig({ authOrigin: 'https://auth.boogy.ai', owner: 'alice' });
    expect(() => urls.appOrigin('bob')).toThrow(/base domain|not supported|cross-owner/i);
  });

  it('appOrigin throws when config was never loaded — no hostname fallback', async () => {
    vi.resetModules();
    const urls = await import('./urls');
    expect(() => urls.appOrigin('alice')).toThrow();
  });

  it('authOrigin reads the auth origin from config, not from any part of the hostname', async () => {
    const urls = await withLoadedConfig({ authOrigin: 'https://auth.boogy.ai', owner: 'alice' });
    expect(urls.authOrigin()).toBe('https://auth.boogy.ai');
  });

  it('authOrigin throws when config was never loaded — no hostname fallback', async () => {
    vi.resetModules();
    const urls = await import('./urls');
    expect(() => urls.authOrigin()).toThrow();
  });

  // Decision 3: `/boogy/config` deliberately 404s on a verified custom
  // domain (no `/boogy/*` surface exists there at all). Pinning this as an
  // honest failure — rather than a silent fallback to the hostname — is
  // what stops a future "fix" from quietly reintroducing the derive-from-
  // hostname defect this module exists to remove.
  it('a verified custom domain — where /boogy/config 404s — fails honestly instead of falling back to the hostname', async () => {
    vi.resetModules();
    const { loadPlatformConfig } = await import('./platform-config');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('no API matched this route', { status: 404 }),
    );
    await expect(loadPlatformConfig()).rejects.toMatchObject({ code: 'config_unavailable' });
    vi.restoreAllMocks();

    const urls = await import('./urls');
    expect(() => urls.authOrigin()).toThrow();
    expect(() => urls.appOrigin('anyone')).toThrow();
  });
});

describe('parseApp', () => {
  it('parses owner/service', () => {
    expect(parseApp('alice/notes')).toEqual({ owner: 'alice', service: 'notes' });
  });

  it('throws on boogy:// scheme', () => {
    expect(() => parseApp('boogy://x')).toThrow();
  });

  it('throws on empty string', () => {
    expect(() => parseApp('')).toThrow();
  });

  it('throws on single segment', () => {
    expect(() => parseApp('alice')).toThrow();
  });

  it('throws on extra segments', () => {
    expect(() => parseApp('a/b/c')).toThrow();
  });

  it('throws on empty owner', () => {
    expect(() => parseApp('/service')).toThrow();
  });

  it('throws on empty service', () => {
    expect(() => parseApp('owner/')).toThrow();
  });
});

describe('baseFromHost', () => {
  it('strips https scheme', () => {
    expect(baseFromHost('https://boogy.ai')).toBe('boogy.ai');
  });

  it('strips http scheme', () => {
    expect(baseFromHost('http://boogy.ai')).toBe('boogy.ai');
  });

  it('strips trailing slash', () => {
    expect(baseFromHost('https://boogy.ai/')).toBe('boogy.ai');
  });

  it('returns bare domain unchanged', () => {
    expect(baseFromHost('boogy.ai')).toBe('boogy.ai');
  });
});

// These two describe blocks cover the pure `platformConfig().owner === owner`
// (own-owner) branch only, using the file-level fixture seeded above. The
// foreign-owner branch, the "never loaded" throw, and the custom-domain
// honest failure are covered in the config-driven-origins block above, which
// needs per-test config control that this file-wide fixture doesn't give.
describe('appOrigin', () => {
  it('builds the own-owner origin from the page location', () => {
    vi.stubGlobal('location', { origin: 'https://alice.boogy.ai' });
    expect(appOrigin('alice')).toBe('https://alice.boogy.ai');
    vi.unstubAllGlobals();
  });
});

describe('authOrigin', () => {
  it('reads the auth origin from config', () => {
    expect(authOrigin()).toBe('https://auth.boogy.ai');
  });
});

describe('authorizeUrl', () => {
  const params = {
    owner: 'alice',
    services: ['notes'],
    redirect: '/notes/callback',
    state: 'abc123',
    codeChallenge: 'challenge_value',
    mode: 'popup' as const,
  };

  beforeAll(() => {
    vi.stubGlobal('location', { origin: 'https://alice.boogy.ai' });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('points to auth subdomain', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.origin).toBe('https://auth.boogy.ai');
  });

  it('has /authorize path', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.pathname).toBe('/authorize');
  });

  it('sets aud to workload URI', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.searchParams.get('aud')).toBe('boogy://alice/services/notes');
  });

  it('sets app_origin to subdomain', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.searchParams.get('app_origin')).toBe('https://alice.boogy.ai');
  });

  it('sets mode', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.searchParams.get('mode')).toBe('popup');
  });

  it('sets redirect', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.searchParams.get('redirect')).toBe('/notes/callback');
  });

  it('sets state', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.searchParams.get('state')).toBe('abc123');
  });

  it('sets code_challenge', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.searchParams.get('code_challenge')).toBe('challenge_value');
  });

  it('appends one aud param per service, in order — not the last one only', () => {
    const u = new URL(authorizeUrl({ ...params, services: ['notes', 'todos'] }));
    expect(u.searchParams.getAll('aud')).toEqual([
      'boogy://alice/services/notes',
      'boogy://alice/services/todos',
    ]);
  });
});

describe('parseApps', () => {
  it('normalises a single string into a one-app batch', () => {
    expect(parseApps('alice/notes')).toEqual({ owner: 'alice', services: ['notes'] });
  });

  it('collects services from multiple apps under the same owner', () => {
    expect(parseApps(['alice/notes', 'alice/todos'])).toEqual({
      owner: 'alice',
      services: ['notes', 'todos'],
    });
  });

  it('deduplicates a repeated app, preserving first-seen order', () => {
    expect(parseApps(['alice/notes', 'alice/todos', 'alice/notes'])).toEqual({
      owner: 'alice',
      services: ['notes', 'todos'],
    });
  });

  it('throws on an empty batch', () => {
    expect(() => parseApps([])).toThrow();
  });

  it('throws naming the offending app when a batch spans owners', () => {
    expect(() => parseApps(['alice/notes', 'bob/todos'])).toThrow(/bob\/todos/);
  });

  it('populates BoogyError.app with the offending app on a cross-owner batch', () => {
    try {
      parseApps(['alice/notes', 'bob/todos']);
      throw new Error('expected parseApps to throw');
    } catch (e) {
      expect((e as BoogyError).app).toBe('bob/todos');
    }
  });

  it('throws naming the count and the limit over the cap', () => {
    const apps = Array.from({ length: MAX_AUDIENCES + 1 }, (_, i) => `alice/svc${i}`);
    expect(() => parseApps(apps)).toThrow(new RegExp(String(MAX_AUDIENCES + 1)));
    expect(() => parseApps(apps)).toThrow(new RegExp(String(MAX_AUDIENCES)));
  });

  it('over the cap with duplicates present, names BOTH the raw count and the distinct count', () => {
    // MAX_AUDIENCES + 1 distinct entries, one of them repeated once =>
    // MAX_AUDIENCES + 2 raw, MAX_AUDIENCES + 1 distinct — still over the cap.
    const apps = [
      ...Array.from({ length: MAX_AUDIENCES + 1 }, (_, i) => `alice/svc${i}`),
      'alice/svc0',
    ];
    expect(apps).toHaveLength(MAX_AUDIENCES + 2);

    let message = '';
    try {
      parseApps(apps);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain(String(MAX_AUDIENCES + 2)); // the raw count the caller passed
    expect(message).toContain(String(MAX_AUDIENCES + 1)); // the distinct count actually checked against the cap
  });

  it('allows exactly the cap with no error', () => {
    const apps = Array.from({ length: MAX_AUDIENCES }, (_, i) => `alice/svc${i}`);
    expect(parseApps(apps).services).toHaveLength(MAX_AUDIENCES);
  });

  /// The cap is DERIVED from the header arithmetic, not chosen — pinned against
  /// the number the design reasons from, not just against itself. Every test
  /// above derives its expectation FROM `MAX_AUDIENCES`, so none of them can
  /// catch the constant itself drifting to the wrong value; this is the one
  /// that pins the literal (mirrors `sso::MAX_AUDS`'s own Rust-side test).
  it('MAX_AUDIENCES leaves real headroom under the proxy line', () => {
    expect(MAX_AUDIENCES).toBe(32);
    expect(MAX_AUDIENCES * 136).toBeLessThan(8 * 1024);
    expect(MAX_AUDIENCES * 2 * 136).toBeGreaterThan(8 * 1024);
  });
});

describe('siteSignInUrl / siteSignOutUrl — a board signing the apps\' site in and out', () => {
  it('goes through the apps\' site with every app and the way back', () => {
    const u = new URL(
      siteSignInUrl({
        site: 'https://alice.boogy.ai',
        owner: 'alice',
        services: ['squad', 'notes'],
        returnTo: 'https://boards.boogy.ai/boards/b/1',
      }),
    );
    expect(u.origin).toBe('https://alice.boogy.ai');
    expect(u.pathname).toBe('/boogy/signin');
    expect(u.searchParams.getAll('aud')).toEqual(['boogy://alice/services/squad', 'boogy://alice/services/notes']);
    expect(u.searchParams.get('redirect')).toBe('https://boards.boogy.ai/boards/b/1');
  });

  it('takes only the origin of the site it is given', () => {
    const u = new URL(
      siteSignInUrl({ site: 'https://alice.boogy.ai/squad/x', owner: 'alice', services: ['squad'], returnTo: '/' }),
    );
    expect(u.origin + u.pathname).toBe('https://alice.boogy.ai/boogy/signin');
  });

  it('signs the apps\' site out with the way back', () => {
    const u = new URL(siteSignOutUrl({ site: 'https://alice.boogy.ai', returnTo: 'https://boards.boogy.ai/boards/' }));
    expect(u.origin + u.pathname).toBe('https://alice.boogy.ai/boogy/logout');
    expect(u.searchParams.get('redirect')).toBe('https://boards.boogy.ai/boards/');
  });
});
