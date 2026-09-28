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
    });
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
