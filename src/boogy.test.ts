import { describe, it, expect, vi, afterEach } from 'vitest';
import { Boogy } from './boogy';

// happy-dom provides globalThis.fetch; we spy/mock it per test.

describe('Boogy.fetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries once after a 401 by calling connectApp, then returns the second response', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const boogy = new Boogy({ host: 'https://boogy.ai' });
    const connectSpy = vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);

    const res = await boogy.fetch('alice/notes', '/api/x');

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(connectSpy).toHaveBeenCalledWith('alice/notes');
    const firstUrl = fetchSpy.mock.calls[0][0] as string;
    expect(firstUrl).toBe('https://alice.boogy.ai/notes/api/x');
  });

  it('does NOT throw on a 404 from the app — returns the Response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }));

    const res = await new Boogy({ host: 'https://boogy.ai' }).fetch('alice/notes', '/api/x');

    expect(res.status).toBe(404);
  });

  it('does NOT retry a second time when the retried response is also 401', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }));

    const boogy = new Boogy({ host: 'https://boogy.ai' });
    vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);

    const res = await boogy.fetch('alice/notes', '/api/x');

    // exactly 2 fetch calls (1 original + 1 retry), no further attempts
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(401);
  });

  it('throws BoogyError("network") on a network / CORS error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      new Boogy({ host: 'https://boogy.ai' }).fetch('alice/notes', '/api/x'),
    ).rejects.toMatchObject({ code: 'network' });
  });

  it('passes init options to the underlying fetch call', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 200 }));

    await new Boogy({ host: 'https://boogy.ai' }).fetch('alice/notes', '/api/x', {
      method: 'POST',
      body: '{"a":1}',
    });

    const [, init] = fetchSpy.mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).credentials).toBe('include');
  });
});

describe('Boogy.currentUser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses and returns {pairwiseId, connectedAt} on a 200 JSON response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ pairwiseId: 'pid_abc', connectedAt: '2024-01-01T00:00:00Z' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const user = await new Boogy({ host: 'https://boogy.ai' }).currentUser('alice/notes');

    expect(user).toEqual({ pairwiseId: 'pid_abc', connectedAt: '2024-01-01T00:00:00Z' });
  });

  it('returns null when the body is the JSON literal null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('null', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const user = await new Boogy({ host: 'https://boogy.ai' }).currentUser('alice/notes');

    expect(user).toBeNull();
  });

  it('returns null on a non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));

    const user = await new Boogy({ host: 'https://boogy.ai' }).currentUser('alice/notes');

    expect(user).toBeNull();
  });

  it('returns null on a network error (never throws)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const user = await new Boogy({ host: 'https://boogy.ai' }).currentUser('alice/notes');

    expect(user).toBeNull();
  });

  it('hits the correct /boogy/me endpoint with credentials:include', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('null', { status: 200 }),
    );

    await new Boogy({ host: 'https://boogy.ai' }).currentUser('alice/notes');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://alice.boogy.ai/boogy/me');
    expect((init as RequestInit).credentials).toBe('include');
  });
});

describe('Boogy.listGrants', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GETs auth-origin /_agents/grants with credentials:include and maps rows to Grant[]', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([{ app: 'alice/notes', connectedAt: 't1', lastUsedAt: 't2' }]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const g = await new Boogy({ host: 'https://boogy.ai' }).listGrants();

    expect(g[0].app).toBe('alice/notes');
    expect(g[0].connectedAt).toBe('t1');
    expect(g[0].lastUsedAt).toBe('t2');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://auth.boogy.ai/_agents/grants');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('throws BoogyError("network") with dashboard-origin note on a CORS/network TypeError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      new Boogy({ host: 'https://boogy.ai' }).listGrants(),
    ).rejects.toMatchObject({ code: 'network' });

    await expect(
      new Boogy({ host: 'https://boogy.ai' }).listGrants(),
    ).rejects.toThrow(/dashboard/i);
  });

  it('throws BoogyError("network") on a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }));

    await expect(
      new Boogy({ host: 'https://boogy.ai' }).listGrants(),
    ).rejects.toMatchObject({ code: 'network' });
  });
});

describe('Boogy.revokeApp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('DELETEs auth-origin /_agents/grants/{owner}/{service} with credentials:include', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 204 }));

    await new Boogy({ host: 'https://boogy.ai' }).revokeApp('alice/notes');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://auth.boogy.ai/_agents/grants/alice/notes');
    expect((init as RequestInit).method).toBe('DELETE');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('resolves on 404 (idempotent — already revoked)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));

    await expect(
      new Boogy({ host: 'https://boogy.ai' }).revokeApp('alice/notes'),
    ).resolves.toBeUndefined();
  });

  it('throws BoogyError("network") with dashboard-origin note on a CORS/network TypeError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      new Boogy({ host: 'https://boogy.ai' }).revokeApp('alice/notes'),
    ).rejects.toMatchObject({ code: 'network' });

    await expect(
      new Boogy({ host: 'https://boogy.ai' }).revokeApp('alice/notes'),
    ).rejects.toThrow(/dashboard/i);
  });
});

describe('Boogy.signOut', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs /boogy/logout on the app origin when given an app string', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 204 }));

    await new Boogy({ host: 'https://boogy.ai' }).signOut('alice/notes');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://alice.boogy.ai/boogy/logout');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('resolves even when signOut(app) gets a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));

    // should not throw
    await expect(
      new Boogy({ host: 'https://boogy.ai' }).signOut('alice/notes'),
    ).resolves.toBeUndefined();
  });

  it('POSTs the auth-origin /_agents/logout for signOut({all:true})', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 204 }));

    await new Boogy({ host: 'https://boogy.ai' }).signOut({ all: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://auth.boogy.ai/_agents/logout');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('resolves even when signOut({all}) POST fails (CORS or network)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('CORS'));

    // best-effort: must not throw
    await expect(
      new Boogy({ host: 'https://boogy.ai' }).signOut({ all: true }),
    ).resolves.toBeUndefined();
  });
});
