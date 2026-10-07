import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

describe('parsePlatformConfig', () => {
  it('accepts a well-formed body', async () => {
    const { parsePlatformConfig } = await import('./platform-config');
    expect(
      parsePlatformConfig({
        authOrigin: 'https://auth.boogy.ai',
        owner: 'alice',
        shellOrigins: ['https://boards.boogy.app'],
      }),
    ).toEqual({
      authOrigin: 'https://auth.boogy.ai',
      owner: 'alice',
      shellOrigins: ['https://boards.boogy.app'],
      boardShell: false,
    });
  });

  // The platform says whether this origin is its board shell, the boards
  // origin, where a board signs its apps in. Only a literal `true` is a yes:
  // anything else, or nothing, is no, so a page never runs a board's sign-in
  // where the platform did not say it may.
  it('reads boardShell: only a literal true is the board shell', async () => {
    const { parsePlatformConfig } = await import('./platform-config');
    const base = { authOrigin: 'https://auth.boogy.app', owner: 'tester', shellOrigins: [], service: 'boards' };
    expect(parsePlatformConfig({ ...base, boardShell: true }).boardShell).toBe(true);
    expect(parsePlatformConfig({ ...base, boardShell: false }).boardShell).toBe(false);
    expect(parsePlatformConfig(base).boardShell).toBe(false);
    expect(parsePlatformConfig({ ...base, boardShell: 'true' }).boardShell).toBe(false);
    expect(parsePlatformConfig({ ...base, boardShell: 1 }).boardShell).toBe(false);
  });

  it('strips a trailing slash from authOrigin', async () => {
    const { parsePlatformConfig } = await import('./platform-config');
    expect(
      parsePlatformConfig({ authOrigin: 'https://auth.boogy.ai/', owner: 'alice', shellOrigins: [] })
        .authOrigin,
    ).toBe('https://auth.boogy.ai');
  });

  it('defaults shellOrigins to an empty list when absent', async () => {
    const { parsePlatformConfig } = await import('./platform-config');
    expect(
      parsePlatformConfig({ authOrigin: 'https://auth.boogy.ai', owner: 'alice' }).shellOrigins,
    ).toEqual([]);
  });

  it('rejects a non-object body', async () => {
    const { parsePlatformConfig } = await import('./platform-config');
    expect(() => parsePlatformConfig(null)).toThrow();
    expect(() => parsePlatformConfig('nope')).toThrow();
  });

  it('rejects a body with no owner handle', async () => {
    const { parsePlatformConfig } = await import('./platform-config');
    expect(() => parsePlatformConfig({ authOrigin: 'https://auth.boogy.ai' })).toThrow();
  });

  it('rejects a body with no absolute authOrigin', async () => {
    const { parsePlatformConfig } = await import('./platform-config');
    expect(() => parsePlatformConfig({ owner: 'alice', authOrigin: 'auth.boogy.ai' })).toThrow();
  });

  it('keeps a module origin\'s service, and drops a non-string one', async () => {
    const { parsePlatformConfig } = await import('./platform-config');
    const base = { authOrigin: 'https://auth.example', owner: 'dave', shellOrigins: [] };
    expect(parsePlatformConfig({ ...base, service: 'chats' })).toMatchObject({ service: 'chats' });
    expect(parsePlatformConfig({ ...base, service: 7 }).service).toBeUndefined();
    // A service has one address, its root: a body naming a mount is read as if it did not.
    expect(parsePlatformConfig({ ...base, service: 'chats', mount: '/' })).not.toHaveProperty('mount');
  });

  // Every service is served at its own address, which the platform allocates:
  // no template composes another app's origin from an owner, and there is no
  // second address to send someone to. A body that still carries either field
  // is read as if it did not.
  it('reads no app-origin template, no second address and no mount: a service has one address, its own', async () => {
    const { parsePlatformConfig } = await import('./platform-config');
    const config = parsePlatformConfig({
      authOrigin: 'https://auth.boogy.app', owner: 'dave', shellOrigins: [], service: 'chats', mount: '/',
      appOriginTemplate: 'https://{owner}.boogy.app', // owner-subdomain-ok: the retired field this test proves unread
      address: 'https://dave.boogy.app/chats/', // owner-subdomain-ok: the retired field this test proves unread
    });
    expect(config).toEqual({ authOrigin: 'https://auth.boogy.app', owner: 'dave', shellOrigins: [], boardShell: false, service: 'chats' });
  });
});

describe('loadPlatformConfig / platformConfig', () => {
  beforeEach(() => {
    // Each test gets a fresh module instance, so the module-scoped cache
    // never leaks between tests — the cache itself is what step 5 is testing.
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('platformConfig() throws before loadPlatformConfig() has ever resolved', async () => {
    const { platformConfig } = await import('./platform-config');
    expect(() => platformConfig()).toThrow();
  });

  it('fetches GET /boogy/config and returns its authOrigin', async () => {
    const { loadPlatformConfig } = await import('./platform-config');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ authOrigin: 'https://auth.boogy.ai', owner: 'alice', shellOrigins: [] }),
        { status: 200 },
      ),
    );

    const config = await loadPlatformConfig();

    expect(config.authOrigin).toBe('https://auth.boogy.ai');
  });

  it('fetches from the origin ROOT path /boogy/config', async () => {
    const { loadPlatformConfig } = await import('./platform-config');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ authOrigin: 'https://auth.boogy.ai', owner: 'alice', shellOrigins: [] }),
        { status: 200 },
      ),
    );

    await loadPlatformConfig();

    expect(fetchSpy.mock.calls[0][0]).toBe('/boogy/config');
  });

  it('serves a second call from the cache — does not fetch again', async () => {
    const { loadPlatformConfig } = await import('./platform-config');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ authOrigin: 'https://auth.boogy.ai', owner: 'alice', shellOrigins: [] }),
        { status: 200 },
      ),
    );

    await loadPlatformConfig();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const second = await loadPlatformConfig();
    expect(second.authOrigin).toBe('https://auth.boogy.ai');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // still 1 — this is the cache assertion
  });

  it('throws when the platform answers non-200 and does not cache the failure', async () => {
    const { loadPlatformConfig } = await import('./platform-config');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));

    await expect(loadPlatformConfig()).rejects.toThrow();
  });

  it('single-flights concurrent calls: two calls before the first resolves make exactly one fetch', async () => {
    const { loadPlatformConfig } = await import('./platform-config');

    // Capture every resolver fetch was given so this test can't hang if the
    // single-flight guard is missing and a second, distinct fetch is made.
    const resolvers: Array<(r: Response) => void> = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>((resolve) => resolvers.push(resolve)),
    );

    const p1 = loadPlatformConfig();
    const p2 = loadPlatformConfig();

    for (const resolve of resolvers) {
      resolve(
        new Response(
          JSON.stringify({ authOrigin: 'https://auth.boogy.ai', owner: 'alice', shellOrigins: [] }),
          { status: 200 },
        ),
      );
    }

    const [c1, c2] = await Promise.all([p1, p2]);
    expect(c1.authOrigin).toBe('https://auth.boogy.ai');
    expect(c2.authOrigin).toBe('https://auth.boogy.ai');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // the fetch-count assertion this guard is for
  });

  it('a rejected load is not cached — a later call genuinely retries with a new fetch', async () => {
    const { loadPlatformConfig } = await import('./platform-config');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ authOrigin: 'https://auth.boogy.ai', owner: 'alice', shellOrigins: [] }),
          { status: 200 },
        ),
      );

    await expect(loadPlatformConfig()).rejects.toMatchObject({ code: 'config_unavailable' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const config = await loadPlatformConfig();
    expect(config.authOrigin).toBe('https://auth.boogy.ai');
    expect(fetchSpy).toHaveBeenCalledTimes(2); // a real second fetch, not a replayed rejection
  });

  it('throws BoogyError with code config_unavailable on a network failure', async () => {
    const { loadPlatformConfig } = await import('./platform-config');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network down'));

    await expect(loadPlatformConfig()).rejects.toMatchObject({ code: 'config_unavailable' });
  });
});
