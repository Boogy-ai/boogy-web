import { describe, it, expect, vi, afterEach, afterAll, beforeAll } from 'vitest';
import {
  parseApp,
  baseFromHost,
  appOrigin,
  authOrigin,
} from './urls';
import { loadPlatformConfig } from './platform-config';
import type { BoogyError } from '../errors';

// The `appOrigin`/`authOrigin` tests below use the STATIC
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
      JSON.stringify({ authOrigin: 'https://auth.boogy.ai', owner: 'alice', shellOrigins: [], service: 'notes' }),
      { status: 200 },
    ),
  );
  await loadPlatformConfig();
  vi.restoreAllMocks();
});

// ─── Config-driven origins (task B3a) ──────────────────────────────────────
//
// `appOrigin`/`authOrigin` now read from the platform-config
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
  service?: string;
  mount?: string;
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

  it('its own service: appOrigin returns the PAGE origin, not a constructed one', async () => {
    vi.stubGlobal('location', { origin: 'https://boards.boogy.app' });
    const urls = await withLoadedConfig({ authOrigin: 'https://auth.boogy.ai', owner: 'alice', service: 'boards' });
    expect(urls.appOrigin('alice', 'boards')).toBe('https://boards.boogy.app');
  });

  // On a service's own label the platform names its one service, and that is
  // the only app the label serves: its origin is this page's own, and any
  // other app is not here at any path.
  it('on a service\'s own label: that service is this origin, and no other app is', async () => {
    vi.stubGlobal('location', { origin: 'https://chats-k3v9.boogy.app' });
    const urls = await withLoadedConfig({ authOrigin: 'https://auth.boogy.app', owner: 'dave', service: 'chats' });
    expect(urls.appOrigin('dave', 'chats')).toBe('https://chats-k3v9.boogy.app');
    for (const [owner, service] of [['dave', 'notes'], ['erin', 'chats']]) {
      expect(() => urls.appOrigin(owner, service), `${owner}/${service}`).toThrow(expect.objectContaining({ code: 'app_not_found' }));
    }
  });

  // A verified custom domain, or a designated label, is bound to one service
  // too, and the platform names it there: the owner's other services are not
  // served on that origin, at any path.
  it('on a bound origin: its one service is this origin, and the owner\'s other services are not', async () => {
    vi.stubGlobal('location', { origin: 'https://notes.example.com' });
    const urls = await withLoadedConfig({ authOrigin: 'https://auth.boogy.app', owner: 'dave', service: 'notes' });
    expect(urls.appOrigin('dave', 'notes')).toBe('https://notes.example.com');
    expect(() => urls.appOrigin('dave', 'chats')).toThrow(expect.objectContaining({ code: 'app_not_found', app: 'dave/chats' }));
  });

  // Another app's address is a label the platform allocated (`notes-k3v9`):
  // nothing on this page can compose it from the app's owner and id, and a
  // guess would send the request to whatever answers there. So it is refused,
  // naming the app, rather than composed.
  it('another owner\'s app: refused as not served here, never composed', async () => {
    vi.stubGlobal('location', { origin: 'https://boards.boogy.app' });
    const urls = await withLoadedConfig({ authOrigin: 'https://auth.boogy.ai', owner: 'alice' });
    let thrown: unknown;
    try {
      urls.appOrigin('bob', 'notes');
    } catch (e) {
      thrown = e;
    }
    expect((thrown as BoogyError).code).toBe('app_not_found');
    expect((thrown as BoogyError).app).toBe('bob/notes');
  });

  it('appOrigin throws when config was never loaded — no hostname fallback', async () => {
    vi.resetModules();
    const urls = await import('./urls');
    expect(() => urls.appOrigin('alice', 'notes')).toThrow();
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

  // An origin the platform has no config for answers `/boogy/config` with a
  // 404. Pinning this as an honest failure — rather than a silent fallback to
  // the hostname — is what stops a future "fix" from quietly reintroducing
  // the derive-from-hostname defect this module exists to remove.
  it('an origin where /boogy/config 404s fails honestly instead of falling back to the hostname', async () => {
    vi.resetModules();
    const { loadPlatformConfig } = await import('./platform-config');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('no API matched this route', { status: 404 }),
    );
    await expect(loadPlatformConfig()).rejects.toMatchObject({ code: 'config_unavailable' });
    vi.restoreAllMocks();

    const urls = await import('./urls');
    expect(() => urls.authOrigin()).toThrow();
    expect(() => urls.appOrigin('anyone', 'notes')).toThrow();
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
    vi.stubGlobal('location', { origin: 'https://notes-k3v9.boogy.app' });
    expect(appOrigin('alice', 'notes')).toBe('https://notes-k3v9.boogy.app');
    vi.unstubAllGlobals();
  });
});

describe('authOrigin', () => {
  it('reads the auth origin from config', () => {
    expect(authOrigin()).toBe('https://auth.boogy.ai');
  });
});

describe('appBaseUrl', () => {
  async function withConfig(body: object) {
    vi.resetModules();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
    const config = await import('./platform-config');
    await config.loadPlatformConfig();
    vi.restoreAllMocks();
    return import('./urls');
  }

  it('is the origin itself on the app\'s own origin', async () => {
    const urls = await withConfig({ authOrigin: 'https://auth.example', owner: 'dave', shellOrigins: [], service: 'chats' });
    expect(urls.appBaseUrl('dave', 'chats')).toBe(location.origin);
  });

  // Every service is served at the root of its own address, so its routes
  // start at the origin, never under a path named for the service.
  it('is the origin itself, never a path under it', async () => {
    const urls = await withConfig({ authOrigin: 'https://auth.example', owner: 'dave', shellOrigins: [], service: 'boards' });
    expect(urls.appBaseUrl('dave', 'boards')).toBe(location.origin);
  });

  // An origin the platform names no service for serves no app at all.
  it('refuses every app where the platform names no service', async () => {
    const urls = await withConfig({ authOrigin: 'https://auth.example', owner: 'dave', shellOrigins: [] });
    expect(() => urls.appBaseUrl('dave', 'boards')).toThrow(/names no service/);
  });

  // A service's own label serves its ONE service: another service is not
  // here at any path, so addressing it here would send the request to this
  // app's own backend (a 200 with the wrong app's page, a write to the wrong
  // service). Refused, naming the app, rather than misaddressed.
  it('refuses any other app on a service\'s own label', async () => {
    const urls = await withConfig({ authOrigin: 'https://auth.example', owner: 'dave', shellOrigins: [], service: 'chats' });
    for (const [owner, service] of [['dave', 'notes'], ['erin', 'chats'], ['erin', 'notes']]) {
      let thrown: unknown;
      try {
        urls.appBaseUrl(owner, service);
      } catch (e) {
        thrown = e;
      }
      expect((thrown as Error | undefined)?.name, `${owner}/${service}`).toBe('BoogyError');
      expect((thrown as BoogyError).code).toBe('app_not_found');
      expect((thrown as BoogyError).app).toBe(`${owner}/${service}`);
    }
  });
});
