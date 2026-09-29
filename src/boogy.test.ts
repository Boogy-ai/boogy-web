import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest';
import { Boogy } from './boogy';
import { MAX_AUDIENCES } from './internal/urls';
import { loadPlatformConfig } from './internal/platform-config';

// Every test in this file constructs `new Boogy()` with no options (the
// constructor no longer takes a `host` — it was removed entirely, not
// deprecated) and expects `alice`'s app origin to be `https://alice.boogy.ai`
// — `appOrigin`/`authOrigin` read `platformConfig()`, and the own-owner branch
// reads `location.origin`. So this file seeds config ONCE here, and stubs
// `location` to the origin every existing assertion already assumes, rather
// than touching each test.
// `platformConfig()`'s cache is module-scoped: this file never resets
// modules, so seeding it once via the same static import path `boogy.ts`
// itself uses is enough for the whole file.
beforeAll(async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(
      JSON.stringify({ authOrigin: 'https://auth.boogy.ai', owner: 'alice', shellOrigins: [] }),
      { status: 200 },
    ),
  );
  await loadPlatformConfig();
  vi.restoreAllMocks();
  vi.stubGlobal('location', { origin: 'https://alice.boogy.ai', pathname: '/', search: '' });
});

// happy-dom provides globalThis.fetch; we spy/mock it per test.
//
// The silent-renewal guards below persist their state in sessionStorage,
// which happy-dom keeps alive for the whole file rather than resetting per
// test — clear it before every test so one test's "session seen" marker
// can't leak into the next.
beforeEach(() => {
  try {
    sessionStorage.clear();
  } catch {
    /* not required for these tests to be meaningful */
  }
});

describe('Boogy.fetch', () => {
  // These exercise the ROUND TRIP, which runs only when silent renewal could
  // not help (no renewal cookie on this site). Stated once, here, rather than
  // by threading an extra `/boogy/renew` response through every call count.
  beforeEach(() => {
    vi.spyOn(Boogy.prototype, 'refreshSession').mockResolvedValue(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries once after a 401 by calling connectApp, then returns the second response', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      // First call arms the "session seen in this tab" marker that renewal
      // is guarded on (see the "silent renewal is guarded" tests below) —
      // without it this 401 would not be renewed at all.
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const boogy = new Boogy();
    const connectSpy = vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);

    await boogy.fetch('alice/notes', '/api/x'); // arms the session
    const res = await boogy.fetch('alice/notes', '/api/x');

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(connectSpy).toHaveBeenCalledWith('alice/notes');
    const retriedUrl = fetchSpy.mock.calls[2][0] as string;
    expect(retriedUrl).toBe('https://alice.boogy.ai/notes/api/x');
  });

  it('does NOT throw on a 404 from the app — returns the Response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }));

    const res = await new Boogy().fetch('alice/notes', '/api/x');

    expect(res.status).toBe(404);
  });

  it('does NOT retry a second time when the retried response is also 401', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('ok', { status: 200 })) // arms the session
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }));

    const boogy = new Boogy();
    vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);

    await boogy.fetch('alice/notes', '/api/x'); // arms the session
    const res = await boogy.fetch('alice/notes', '/api/x');

    // exactly 2 fetch calls for THIS invocation (1 original + 1 retry), no further attempts
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(res.status).toBe(401);
  });

  it('throws BoogyError("network") on a network / CORS error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      new Boogy().fetch('alice/notes', '/api/x'),
    ).rejects.toMatchObject({ code: 'network' });
  });

  it('passes init options to the underlying fetch call', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 200 }));

    await new Boogy().fetch('alice/notes', '/api/x', {
      method: 'POST',
      body: '{"a":1}',
    });

    const [, init] = fetchSpy.mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).credentials).toBe('include');
  });
});

// Regression tests: `Boogy.fetch` has always renewed on a 401 by calling
// `connectApp` — but until now with NO guard of any kind. In `redirect` mode
// `connectApp` navigates the whole page to `/authorize`, so an unguarded
// renewal bounces a first-time, never-signed-in visitor through the sign-in
// flow on their very first 401, and a session that never comes back can
// redirect-loop forever. These three guards close that: renewal fires only
// for a caller that has previously held a session in this tab, backs off for
// a cooldown after an attempt, and never fires again after a deliberate
// sign-out.
describe('Boogy.fetch — silent renewal is guarded', () => {
  // These exercise the ROUND TRIP, which runs only when silent renewal could
  // not help (no renewal cookie on this site). Stated once, here, rather than
  // by threading an extra `/boogy/renew` response through every call count.
  beforeEach(() => {
    vi.spyOn(Boogy.prototype, 'refreshSession').mockResolvedValue(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attempts renewal once across two 401s, then withholds it for the cooldown', async () => {
    // Every possible call is covered by `mockImplementation`, not a finite
    // queue of `mockResolvedValueOnce`s: if the cooldown guard fails to hold
    // and the SDK attempts a SECOND renewal (an extra `connectApp` call plus
    // an extra retry `fetch`), that must show up as a call-count mismatch
    // below — not as a queue running dry and falling through to a real,
    // unmocked network call, which would fail the test for an unrelated
    // reason (an incidental throw) rather than for the cooldown itself.
    let calls = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      calls += 1;
      // First call arms the session; every call after that is a 401.
      return Promise.resolve(new Response(calls === 1 ? 'ok' : '', { status: calls === 1 ? 200 : 401 }));
    });

    const boogy = new Boogy();
    const connectSpy = vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);

    await boogy.fetch('alice/notes', '/api/x'); // arms the session
    const first = await boogy.fetch('alice/notes', '/api/x');
    const second = await boogy.fetch('alice/notes', '/api/x');

    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    // The call count is the guard: a cooldown nobody counts is a cooldown
    // nobody has.
    expect(connectSpy).toHaveBeenCalledTimes(1);
    // arm(1) + first call's original+retry(2) + second call's original-only(1) = 4
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('does not renew a 401 for a caller that has never held a session', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 401 }));

    const boogy = new Boogy();
    const connectSpy = vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);

    const res = await boogy.fetch('alice/notes', '/api/x');

    expect(res.status).toBe(401);
    expect(connectSpy).not.toHaveBeenCalled();
    // No retry either — one underlying fetch call for one 401.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not renew after signOut, even racing a 401 issued while the sign-out request is still in flight', async () => {
    let resolveLogout!: (r: Response) => void;
    const logoutResponse = new Promise<Response>((resolve) => {
      resolveLogout = resolve;
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/boogy/logout')) return logoutResponse;
      if (url.includes('/api/arm')) return Promise.resolve(new Response('ok', { status: 200 }));
      return Promise.resolve(new Response('', { status: 401 }));
    });

    const boogy = new Boogy();
    const connectSpy = vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);

    await boogy.fetch('alice/notes', '/api/arm'); // arms the session

    // Start the sign-out but don't await it yet — its logout request is
    // still pending. A 401 elsewhere races it.
    const signOutPromise = boogy.signOut('alice/notes');
    const racingFetch = boogy.fetch('alice/notes', '/api/x');

    resolveLogout(new Response('', { status: 204 }));
    await signOutPromise;
    await racingFetch;

    // The marker must be cleared BEFORE the logout request is issued, not
    // after it resolves — otherwise the racing 401 above still sees an armed
    // session and renews it, signing the user back in during their own
    // sign-out.
    expect(connectSpy).not.toHaveBeenCalled();
    // arm(1) + logout(1) + racing fetch, no retry (1) = 3
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});

// Regression tests for a review finding on the `renewAudiences` seam (item
// 5 of the original task). Renewal is an optimisation layered on top of an
// ordinary 401, so a caller-supplied `renewAudiences` must never turn that
// 401 into an uncaught rejection — a provider that throws, or a batch that
// is invalid for any reason (spanning owners, or over the platform's
// per-request audience cap), degrades to the original 401 response.
//
// There used to be a truncation path here for an over-cap batch: the failing
// app plus as many of `renewAudiences`'s apps as fit, with the remainder
// silently dropped and reported via a console warning. That's gone —
// signing into a board means signing into the board, not a subset — so an
// over-cap combined batch is refused exactly like one spanning owners.
describe('Boogy.fetch — a broken or over-cap renewAudiences degrades gracefully', () => {
  // These exercise the ROUND TRIP, which runs only when silent renewal could
  // not help (no renewal cookie on this site). Stated once, here, rather than
  // by threading an extra `/boogy/renew` response through every call count.
  beforeEach(() => {
    vi.spyOn(Boogy.prototype, 'refreshSession').mockResolvedValue(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Arm the "session seen" marker, then restore mocks so the caller's own
   * `fetchSpy`/`connectSpy` call counts start clean. */
  async function armSession(boogy: Boogy): Promise<void> {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await boogy.fetch('alice/notes', '/api/arm');
    vi.restoreAllMocks();
    // `restoreAllMocks` also undid the block's silent-renewal stub; restate it.
    vi.spyOn(Boogy.prototype, 'refreshSession').mockResolvedValue(false);
  }

  it('does not reject when renewAudiences throws — resolves with the original 401', async () => {
    const boogy = new Boogy({
      renewAudiences: () => {
        throw new Error('pane registry not ready');
      },
    });
    await armSession(boogy);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
    const connectSpy = vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await boogy.fetch('alice/notes', '/api/x');

    expect(res.status).toBe(401);
    expect(connectSpy).not.toHaveBeenCalled(); // never reached — renewAudiences threw first
    expect(fetchSpy).toHaveBeenCalledTimes(1); // no retry attempted
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reject when the combined batch is over the cap — resolves with the original 401, no panes signed in', async () => {
    // MAX_AUDIENCES candidate panes, none of them the failing app itself, so
    // the combined batch (failing app + candidates) is one over the cap.
    const paneAudiences = Array.from({ length: MAX_AUDIENCES }, (_, i) => `alice/pane${i}`);
    const boogy = new Boogy({
      renewAudiences: () => paneAudiences,
    });
    await armSession(boogy);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
    const connectSpy = vi.spyOn(boogy, 'connectApp'); // real implementation, real validation
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await boogy.fetch('alice/notes', '/api/x');

    // No truncated send — the whole batch is refused, so the original 401
    // comes back exactly as if renewal had never been attempted.
    expect(res.status).toBe(401);
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // no retry attempted
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reject when the batch spans owners — resolves with the original 401', async () => {
    const boogy = new Boogy({
      renewAudiences: () => ['bob/other'],
    });
    await armSession(boogy);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
    const connectSpy = vi.spyOn(boogy, 'connectApp'); // real implementation, real validation
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await boogy.fetch('alice/notes', '/api/x');

    expect(res.status).toBe(401);
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('regression: a working renewAudiences still renews the whole batch and retries exactly as before', async () => {
    const boogy = new Boogy({
      renewAudiences: () => ['alice/todos'],
    });
    await armSession(boogy);

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const connectSpy = vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await boogy.fetch('alice/notes', '/api/x');

    expect(res.status).toBe(200);
    expect(connectSpy).toHaveBeenCalledWith(['alice/notes', 'alice/todos']);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).not.toHaveBeenCalled();
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

    const user = await new Boogy().currentUser('alice/notes');

    expect(user).toEqual({ pairwiseId: 'pid_abc', connectedAt: '2024-01-01T00:00:00Z' });
  });

  it('returns null when the body is the JSON literal null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('null', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const user = await new Boogy().currentUser('alice/notes');

    expect(user).toBeNull();
  });

  it('returns null on a non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));

    const user = await new Boogy().currentUser('alice/notes');

    expect(user).toBeNull();
  });

  it('returns null on a network error (never throws)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const user = await new Boogy().currentUser('alice/notes');

    expect(user).toBeNull();
  });

  it('hits the correct /boogy/me endpoint with credentials:include', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('null', { status: 200 }),
    );

    await new Boogy().currentUser('alice/notes');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://alice.boogy.ai/boogy/me?service=notes');
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

    const g = await new Boogy().listGrants();

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
      new Boogy().listGrants(),
    ).rejects.toMatchObject({ code: 'network' });

    await expect(
      new Boogy().listGrants(),
    ).rejects.toThrow(/dashboard/i);
  });

  it('throws BoogyError("network") on a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }));

    await expect(
      new Boogy().listGrants(),
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

    await new Boogy().revokeApp('alice/notes');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://auth.boogy.ai/_agents/grants/alice/notes');
    expect((init as RequestInit).method).toBe('DELETE');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('resolves on 404 (idempotent — already revoked)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));

    await expect(
      new Boogy().revokeApp('alice/notes'),
    ).resolves.toBeUndefined();
  });

  it('throws BoogyError("network") with dashboard-origin note on a CORS/network TypeError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      new Boogy().revokeApp('alice/notes'),
    ).rejects.toMatchObject({ code: 'network' });

    await expect(
      new Boogy().revokeApp('alice/notes'),
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

    await new Boogy().signOut('alice/notes');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://alice.boogy.ai/boogy/logout?service=notes');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('resolves false, never throws, when signOut(app) gets a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));

    // should not throw; says the platform did not confirm it
    await expect(
      new Boogy().signOut('alice/notes'),
    ).resolves.toBe(false);
  });

  it('POSTs the auth-origin /_agents/logout for signOut({all:true})', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 204 }));

    await new Boogy().signOut({ all: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://auth.boogy.ai/_agents/logout');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('resolves false, never throws, when signOut({all}) POST fails (CORS or network)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('CORS'));

    // best-effort: must not throw; says it did not happen
    await expect(
      new Boogy().signOut({ all: true }),
    ).resolves.toBe(false);
  });
});

describe('Boogy.connectApp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens /authorize with exactly one aud param for a single app — the regression guard', async () => {
    const fakePopup = { closed: false, close: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakePopup as unknown as Window);

    const boogy = new Boogy();
    const p = boogy.connectApp('alice/notes');

    await vi.waitFor(() => expect(openSpy).toHaveBeenCalled());
    const openedUrl = new URL(openSpy.mock.calls[0][0] as string);
    expect(openedUrl.searchParams.getAll('aud')).toEqual(['boogy://alice/services/notes']);

    window.dispatchEvent(
      new MessageEvent('message', { origin: 'https://alice.boogy.ai', data: { boogy: 'sso_done' } }),
    );
    await p;
  });

  it('opens /authorize with one aud param per app for a batch — this is the fan-out the feature exists for', async () => {
    const fakePopup = { closed: false, close: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakePopup as unknown as Window);

    const boogy = new Boogy();
    const p = boogy.connectApp(['alice/notes', 'alice/todos']);

    await vi.waitFor(() => expect(openSpy).toHaveBeenCalled());
    const openedUrl = new URL(openSpy.mock.calls[0][0] as string);
    expect(openedUrl.searchParams.getAll('aud')).toEqual([
      'boogy://alice/services/notes',
      'boogy://alice/services/todos',
    ]);

    window.dispatchEvent(
      new MessageEvent('message', { origin: 'https://alice.boogy.ai', data: { boogy: 'sso_done' } }),
    );
    await p;
  });

  it('rejects a batch spanning owners before ever calling window.open', async () => {
    const openSpy = vi.spyOn(window, 'open');
    const boogy = new Boogy();

    await expect(boogy.connectApp(['alice/notes', 'bob/todos'])).rejects.toThrow(/bob\/todos/);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('rejects a batch over the cap before ever calling window.open', async () => {
    const openSpy = vi.spyOn(window, 'open');
    const boogy = new Boogy();
    const apps = Array.from({ length: MAX_AUDIENCES + 1 }, (_, i) => `alice/svc${i}`);

    await expect(boogy.connectApp(apps)).rejects.toThrow(new RegExp(String(MAX_AUDIENCES + 1)));
    expect(openSpy).not.toHaveBeenCalled();
  });
});

describe('Boogy.fetch — silent renewal first', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('location', { origin: 'https://alice.boogy.ai', pathname: '/', search: '' });
  });

  it('a 401 renews silently and retries once, with no round trip', async () => {
    const calls: string[] = [];
    let apiCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((u) => {
      const url = String(u);
      calls.push(url);
      if (url.endsWith('/boogy/renew')) return Promise.resolve(new Response('{}', { status: 200 }));
      apiCalls += 1;
      return Promise.resolve(new Response('', { status: apiCalls === 1 ? 401 : 200 }));
    });
    const boogy = new Boogy();
    const connect = vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);
    const res = await boogy.fetch('alice/notes', '/api/x');
    expect(res.status).toBe(200);
    expect(connect).not.toHaveBeenCalled();
    expect(calls).toEqual([
      'https://alice.boogy.ai/notes/api/x',
      'https://alice.boogy.ai/boogy/renew',
      'https://alice.boogy.ai/notes/api/x',
    ]);
  });

  it('framed, a 401 silent renewal cannot fix is returned — no round trip', async () => {
    vi.stubGlobal('top', {});
    let n = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('', { status: n++ === 0 ? 200 : 401 })),
    );
    const boogy = new Boogy();
    const connect = vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);
    await boogy.fetch('alice/notes', '/api/x'); // arms the session
    expect((await boogy.fetch('alice/notes', '/api/x')).status).toBe(401);
    expect(connect).not.toHaveBeenCalled();
  });
});
