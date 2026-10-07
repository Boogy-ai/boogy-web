import { describe, it, expect, vi } from 'vitest';
import {
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  MAX_PENDING_REVOKES,
  REFRESH_SKEW_MS,
  REVOKE_KEY_PREFIX,
  SESSION_KEY_PREFIX,
  TOKEN_REQUEST_TIMEOUT_MS,
  appTokenSession,
  requestDeadline,
  windowSessionEnv,
  type SessionEnv,
  type SessionLocks,
} from './session';
import { TOKEN_KEY, completeAppToken, type AppToken, type TokenEnv } from './flow';
import { BoogyError } from '../errors';

const AUTH = 'https://auth.boogy.app';
const PAGE = 'https://app.example.com';
const SVC = 'dave/notes';
const KEY = `${SESSION_KEY_PREFIX}${SVC}`;
const PENDING = `${REVOKE_KEY_PREFIX}${SVC}`;
/** A second service on the same page. */
const SVC_Y = 'dave/other';
const KEY_Y = `${SESSION_KEY_PREFIX}${SVC_Y}`;
const PENDING_Y = `${REVOKE_KEY_PREFIX}${SVC_Y}`;
const LOCK = `boogy.app-token:${SVC}`;
const API = 'https://dave.boogy.app/notes/items';
const T0 = 1_700_000_000_000;
const ACCESS_TTL_S = 900;
const REFRESH_TTL_S = 2_592_000;

interface Call {
  url: string;
  method: string | undefined;
  body: unknown;
  headers: Headers;
  credentials: RequestCredentials | undefined;
  keepalive: boolean | undefined;
}

type Answer = Response | Error;
type ServiceAnswer = () => Answer | Promise<Answer>;

function status(code: number, headers: Record<string, string> = {}): Response {
  return new Response(code === 200 ? '{}' : 'refused', { status: code, headers });
}

function json(code: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status: code, headers: { 'content-type': 'application/json' } });
}

function base64url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * The platform's two token endpoints, and one service, behind one fetch. It
 * rotates as the platform does: each refresh supersedes the token presented,
 * and presenting a superseded token — at refresh or at sign-out — is reuse:
 * the sign-in is revoked and `reused` counts the alarm.
 *
 * `claims` mints access tokens that carry an `exp` claim in the SERVER's
 * clock, which runs `deviceAheadMs` behind the page's.
 */
function fakeServer(clock: { now: number }, opts: { claims?: boolean; deviceAheadMs?: number }) {
  let minted = 0;
  const s = {
    current: 'brt_0',
    superseded: new Set<string>(),
    revoked: false,
    reused: 0,
    /** Every POST /sso/token, either grant. */
    token: [] as Call[],
    /** Every POST /sso/token/revoke. */
    revoke: [] as Call[],
    /** Every call to the service. */
    service: [] as Call[],
    /** Scripted answers for the next /sso/token, /revoke and service calls. */
    next: [] as Answer[],
    nextRevoke: [] as Answer[],
    nextService: [] as ServiceAnswer[],
    serviceDefault: (() => status(200)) as ServiceAnswer,
    hold: null as Promise<void> | null,
    holdRevoke: null as Promise<void> | null,
    /** When set, EVERY revoke waits on it (or on its own deadline). */
    revokesHang: null as Promise<void> | null,
    refreshes(): Call[] {
      return s.token.filter((c) => (c.body as Record<string, unknown>)?.grant_type === 'refresh_token');
    },
    /** Hold the next /sso/token call until the returned function is called. */
    holdNext(): () => void {
      let release!: () => void;
      s.hold = new Promise<void>((r) => (release = r));
      return release;
    },
    /** Hold the next /sso/token/revoke call likewise. */
    holdNextRevoke(): () => void {
      let release!: () => void;
      s.holdRevoke = new Promise<void>((r) => (release = r));
      return release;
    },
    /** Hold every revoke from now on, each until its deadline or the release. */
    hangRevokes(): () => void {
      let release!: () => void;
      s.revokesHang = new Promise<void>((r) => (release = r));
      return release;
    },
    fetch: undefined as unknown as typeof fetch,
  };
  const accessToken = (n: number) => {
    if (!opts.claims) return `at_${n}`;
    const serverNowS = Math.floor((clock.now - (opts.deviceAheadMs ?? 0)) / 1000);
    return `at_${n}.${base64url(JSON.stringify({ exp: serverNowS + ACCESS_TTL_S }))}`;
  };
  const grant = (rotating: boolean) => {
    minted += 1;
    if (rotating) s.superseded.add(s.current);
    s.current = `brt_${minted}`;
    s.revoked = false;
    return json(200, {
      access_token: accessToken(minted),
      token_type: 'Bearer',
      expires_in: ACCESS_TTL_S,
      refresh_token: s.current,
      refresh_expires_in: REFRESH_TTL_S,
    });
  };
  s.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    let body: unknown = init?.body ?? null;
    try {
      body = typeof body === 'string' ? JSON.parse(body) : body;
    } catch {
      /* not JSON: kept as sent */
    }
    const call: Call = {
      url,
      method: init?.method,
      body,
      headers: new Headers(init?.headers),
      credentials: init?.credentials,
      keepalive: init?.keepalive,
    };
    // A held request waits for its release — or, as a real fetch does, rejects
    // once its signal aborts.
    const wait = async (held: Promise<void> | null) => {
      if (!held) return;
      const signal = init?.signal;
      const aborted = new Promise<never>((_, reject) => {
        if (signal?.aborted) reject(signal.reason);
        signal?.addEventListener('abort', () => reject(signal.reason));
      });
      await Promise.race([held, aborted]);
    };
    if (url === `${AUTH}/sso/token`) {
      s.token.push(call);
      const held = s.hold;
      s.hold = null;
      await wait(held);
      const scripted = s.next.shift();
      if (scripted instanceof Error) throw scripted;
      if (scripted) return scripted;
      const b = body as Record<string, string>;
      if (b.grant_type === 'authorization_code') return grant(false);
      if (s.superseded.has(b.refresh_token)) {
        s.revoked = true;
        s.reused += 1;
        return status(401);
      }
      if (s.revoked || b.refresh_token !== s.current) return status(401);
      return grant(true);
    }
    if (url === `${AUTH}/sso/token/revoke`) {
      s.revoke.push(call);
      const held = s.holdRevoke ?? s.revokesHang;
      s.holdRevoke = null;
      await wait(held);
      const tok = (body as Record<string, string>).refresh_token;
      // Only the presented token's own sign-in is revoked; an unknown token
      // (another sign-in's) leaves this one alone.
      if (s.superseded.has(tok)) {
        s.reused += 1;
        s.revoked = true;
      } else if (tok === s.current) {
        s.revoked = true;
      }
      const scripted = s.nextRevoke.shift();
      if (scripted instanceof Error) throw scripted;
      return scripted ?? json(200, {});
    }
    s.service.push(call);
    const answer = await (s.nextService.shift() ?? s.serviceDefault)();
    if (answer instanceof Error) throw answer;
    return answer;
  }) as typeof fetch;
  return s;
}

/** A Storage-like map. `throws: 'all'` refuses every call (blocked storage);
 *  `'writes'` reads but refuses every write (a full or private-mode store).
 *  `failWrites` makes that many of the NEXT writes fail (Infinity: all of them),
 *  for a store that fills up mid-session. */
function memoryStorage(throws?: 'all' | 'writes') {
  const map = new Map<string, string>();
  const control = {
    failWrites: 0,
    /** Keys whose every write fails. */
    failKeys: new Set<string>(),
    /** That many of the NEXT removals fail. */
    failRemoves: 0,
  };
  const storage = {
    getItem(k: string) {
      if (throws === 'all') throw new Error('SecurityError: storage is blocked');
      return map.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      if (throws) throw new Error('QuotaExceededError: storage is full');
      if (control.failWrites > 0) {
        control.failWrites -= 1;
        throw new Error('QuotaExceededError: storage is full');
      }
      if (control.failKeys.has(k)) throw new Error('QuotaExceededError: storage is full');
      map.set(k, v);
    },
    removeItem(k: string) {
      if (throws === 'all') throw new Error('SecurityError: storage is blocked');
      if (control.failRemoves > 0) {
        control.failRemoves -= 1;
        throw new Error('UnknownError: storage refused');
      }
      map.delete(k);
    },
  };
  return { storage, map, control };
}

/** `navigator.locks`, shared by every tab of one website: one queue per name. */
function fakeLocks(): SessionLocks {
  const tails = new Map<string, Promise<unknown>>();
  return {
    request<T>(name: string, cb: (lock: unknown) => Promise<T> | T): Promise<T> {
      const run = (tails.get(name) ?? Promise.resolve()).then(() => cb({ name }));
      tails.set(
        name,
        run.then(
          () => undefined,
          () => undefined,
        ),
      );
      return run;
    },
  };
}

type World = ReturnType<typeof world>;

/** One website in one browser: a clock, the platform, shared storage, shared locks. */
function world(o: { throws?: 'all' | 'writes'; claims?: boolean; deviceAheadMs?: number } = {}) {
  const clock = { now: T0 };
  return { clock, server: fakeServer(clock, o), store: memoryStorage(o.throws), locks: fakeLocks() };
}

/** One tab of that website. Records the locks it asks for and the deadlines
 *  it sets; `deadlines[i].abort()` makes the i-th request time out. */
function tab(w: World, o: { locks?: boolean | SessionLocks; storage?: null } = {}) {
  const lockNames: string[] = [];
  const deadlines: { ms: number; abort: () => void }[] = [];
  const env: SessionEnv = {
    storage: o.storage === null ? null : w.store.storage,
    fetch: w.server.fetch,
    now: () => w.clock.now,
    locks:
      o.locks === false
        ? null
        : typeof o.locks === 'object'
          ? o.locks
          : {
              request: (name, cb) => {
                lockNames.push(name);
                return w.locks.request(name, cb);
              },
            },
    deadline: (ms) => {
      const c = new AbortController();
      deadlines.push({ ms, abort: () => c.abort(new DOMException('the request timed out', 'TimeoutError')) });
      return c.signal;
    },
  };
  return { env, lockNames, deadlines };
}

interface Rec {
  authOrigin: string;
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

function record(over: Partial<Rec> = {}): Rec {
  return {
    authOrigin: AUTH,
    accessToken: 'at_0',
    accessExpiresAt: T0 + 10 * 60_000,
    refreshToken: 'brt_0',
    refreshExpiresAt: T0 + REFRESH_TTL_S * 1000,
    ...over,
  };
}

function seed(w: World, over: Partial<Rec> = {}) {
  w.store.map.set(KEY, JSON.stringify(record(over)));
}

function stored(w: World): Record<string, unknown> | null {
  const v = w.store.map.get(KEY);
  return v ? JSON.parse(v) : null;
}

interface Pending {
  authOrigin: string;
  refreshToken: string;
  refreshExpiresAt: number;
  retryAt: number;
  failures: number;
}

function pendingEntry(refreshToken: string, over: Partial<Pending> = {}): Pending {
  return { authOrigin: AUTH, refreshToken, refreshExpiresAt: T0 + REFRESH_TTL_S * 1000, retryAt: 0, failures: 0, ...over };
}

/** The sign-outs this website still owes the platform. */
function pending(w: World): Pending[] | null {
  const v = w.store.map.get(PENDING);
  return v ? JSON.parse(v) : null;
}

async function rejection(p: Promise<unknown>): Promise<BoogyError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(BoogyError);
    return e as BoogyError;
  }
  throw new Error('expected a rejection');
}

const settle = () => new Promise<void>((r) => setTimeout(r, 0));

async function until(cond: () => boolean) {
  for (let i = 0; i < 50 && !cond(); i++) await settle();
  expect(cond()).toBe(true);
}

/** Sign in on this tab: the page the platform sends the person back to runs
 *  `completeAppToken`, which keeps the session in `session`. */
async function signIn(w: World, session: SessionEnv): Promise<AppToken> {
  const trip = new Map([[TOKEN_KEY, JSON.stringify({ state: 'st-1', verifier: 'v'.repeat(43), authOrigin: AUTH, service: SVC })]]);
  let href = `${PAGE}/cb#state=st-1&code=c-1`;
  const env: TokenEnv = {
    location: {
      origin: PAGE,
      get href() {
        return href;
      },
      pathname: '/cb',
      search: '',
      get hash() {
        return new URL(href).hash;
      },
      assign: () => {},
    },
    history: {
      state: null,
      replaceState: (_s: unknown, _t: string, u?: string | URL | null) => {
        href = new URL(String(u), href).href;
      },
    },
    storage: {
      getItem: (k) => trip.get(k) ?? null,
      setItem: (k, v) => void trip.set(k, v),
      removeItem: (k) => void trip.delete(k),
    },
    fetch: w.server.fetch,
    now: () => w.clock.now,
  };
  const token = await completeAppToken(env, session);
  if (!token) throw new Error('the sign-in did not complete');
  return token;
}

describe('appTokenSession: accessToken()', () => {
  it('returns the stored access token while it has more than 60 s left, without fetching', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 + REFRESH_SKEW_MS + 1 });
    const { env, lockNames } = tab(w);
    const s = appTokenSession(SVC, {}, env);
    expect(s.service).toBe(SVC);
    expect(s.signedIn()).toBe(true);
    expect(await s.accessToken()).toBe('at_0');
    expect(await s.accessToken()).toBe('at_0');
    expect(w.server.token).toEqual([]);
    expect(lockNames).toEqual([]);
    expect(stored(w)).toEqual(record({ accessExpiresAt: T0 + REFRESH_SKEW_MS + 1 }));
  });

  it('refreshes when under 60 s remain, stores the new pair, and rotates the refresh token', async () => {
    const w = world();
    // Exactly 60 s left is not MORE than 60 s.
    seed(w, { accessExpiresAt: T0 + REFRESH_SKEW_MS });
    const { env, lockNames } = tab(w);
    const s = appTokenSession(SVC, {}, env);
    expect(await s.accessToken()).toBe('at_1');
    expect(w.server.token.length).toBe(1);
    const [call] = w.server.token;
    expect(call.url).toBe(`${AUTH}/sso/token`);
    expect(call.method).toBe('POST');
    expect(call.credentials).toBe('omit');
    expect(call.headers.get('content-type')).toBe('application/json');
    expect(call.body).toEqual({ grant_type: 'refresh_token', refresh_token: 'brt_0' });
    expect(lockNames).toEqual([LOCK]);
    expect(stored(w)).toEqual({
      authOrigin: AUTH,
      accessToken: 'at_1',
      accessExpiresAt: T0 + ACCESS_TTL_S * 1000,
      refreshToken: 'brt_1',
      refreshExpiresAt: T0 + REFRESH_TTL_S * 1000,
    });
    // The new token is used from here on.
    expect(await s.accessToken()).toBe('at_1');
    expect(w.server.token.length).toBe(1);
  });

  it('two concurrent accessToken() calls in one tab make ONE refresh request', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 });
    const { env, lockNames } = tab(w);
    const a = appTokenSession(SVC, {}, env);
    const b = appTokenSession(SVC, {}, env);
    expect(await Promise.all([a.accessToken(), a.accessToken(), b.accessToken()])).toEqual(['at_1', 'at_1', 'at_1']);
    expect(w.server.refreshes().length).toBe(1);
    // One refresh for the tab: it asks for the cross-tab lock once, not once per caller.
    expect(lockNames).toEqual([LOCK]);
    expect(w.server.reused).toBe(0);
    expect(stored(w)).toMatchObject({ accessToken: 'at_1', refreshToken: 'brt_1' });
  });

  it('takes the cross-tab lock and re-reads storage inside it: a refresh another tab finished is used, not repeated', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 });
    const A = appTokenSession(SVC, {}, tab(w).env);
    const B = appTokenSession(SVC, {}, tab(w).env);
    const release = w.server.holdNext();
    const a = A.accessToken();
    // A holds the lock, its refresh at the platform.
    await until(() => w.server.token.length === 1);
    // B read the old pair before the lock, and queues on it.
    const b = B.accessToken();
    await settle();
    expect(w.server.token.length).toBe(1);
    release();
    expect(await a).toBe('at_1');
    expect(await b).toBe('at_1');
    expect(w.server.refreshes().length).toBe(1);
    expect(w.server.reused).toBe(0);
    expect(stored(w)).toMatchObject({ accessToken: 'at_1', refreshToken: 'brt_1' });
  });

  it('a 401 on refresh forgets the session and rejects sign_in_required', async () => {
    // 401 is every refusal the platform makes of a refresh, a malformed token included. 403 is
    // a refused origin, which a browser cannot read (it carries no CORS); 400 is not sent by
    // the token endpoint, but a readable one is a decision all the same.
    for (const code of [401, 403, 400]) {
      const w = world();
      seed(w, { accessExpiresAt: T0 });
      const s = appTokenSession(SVC, {}, tab(w).env);
      w.server.next.push(status(code));
      const e = await rejection(s.accessToken());
      expect(e.code, String(code)).toBe('sign_in_required');
      expect(e.app, String(code)).toBe(SVC);
      expect(stored(w), String(code)).toBeNull();
      expect(s.signedIn(), String(code)).toBe(false);
      // Nothing is asked of the platform again.
      expect((await rejection(s.accessToken())).code, String(code)).toBe('sign_in_required');
      expect(w.server.token.length, String(code)).toBe(1);
    }
  });

  it('a superseded token the platform reads as reuse ends the session with sign_in_required', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 });
    w.server.superseded.add('brt_0');
    w.server.current = 'brt_7';
    const s = appTokenSession(SVC, {}, tab(w).env);
    expect((await rejection(s.accessToken())).code).toBe('sign_in_required');
    expect(w.server.reused).toBe(1);
    expect(stored(w)).toBeNull();
  });

  it('a refresh answered 200 without a token pair forgets the session rather than present the old token again', async () => {
    // The platform rotates before it answers 200, so the token held may already be superseded:
    // presenting it again would read as theft.
    for (const answer of [
      json(200, { access_token: 'at_1', token_type: 'Bearer', expires_in: ACCESS_TTL_S }),
      new Response('not json', { status: 200 }),
    ]) {
      const w = world();
      seed(w, { accessExpiresAt: T0 });
      const s = appTokenSession(SVC, {}, tab(w).env);
      w.server.next.push(answer);
      expect((await rejection(s.accessToken())).code).toBe('sign_in_required');
      expect(stored(w)).toBeNull();
    }
  });

  it('a network error on refresh keeps the session and rejects network', async () => {
    const w = world();
    // Already expired: there is no live token to fall back on.
    seed(w, { accessExpiresAt: T0 - 1 });
    const s = appTokenSession(SVC, {}, tab(w).env);
    w.server.next.push(new TypeError('Failed to fetch'));
    expect((await rejection(s.accessToken())).code).toBe('network');
    expect(s.signedIn()).toBe(true);
    expect(stored(w)).toMatchObject({ accessToken: 'at_0', refreshToken: 'brt_0' });
    // It backs off rather than asking again at once.
    expect((await rejection(s.accessToken())).code).toBe('network');
    expect(w.server.token.length).toBe(1);
    w.clock.now += BACKOFF_BASE_MS;
    expect(await s.accessToken()).toBe('at_1');
    expect(w.server.token.length).toBe(2);
    // A success clears the back-off.
    expect(stored(w)).toEqual({
      authOrigin: AUTH,
      accessToken: 'at_1',
      accessExpiresAt: w.clock.now + ACCESS_TTL_S * 1000,
      refreshToken: 'brt_1',
      refreshExpiresAt: w.clock.now + REFRESH_TTL_S * 1000,
    });
  });

  it('transient failures back off, honouring a readable Retry-After, capped, never hot-looping and never signing out', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 - 1 });
    const s = appTokenSession(SVC, {}, tab(w).env);
    const steps: [string, Answer, number][] = [
      ['503 with Retry-After', status(503, { 'retry-after': '5' }), 5_000],
      // A refusal with no CORS (the sign-in rate limiter's 429) reaches the page as this.
      ['opaque network error', new TypeError('Failed to fetch'), 2 * BACKOFF_BASE_MS],
      ['readable 429', status(429), 4 * BACKOFF_BASE_MS],
      ['Retry-After past the cap', status(503, { 'retry-after': '86400' }), BACKOFF_MAX_MS],
      ['500', status(500), 16 * BACKOFF_BASE_MS],
      ['opaque response', Response.error(), 32 * BACKOFF_BASE_MS],
      ['doubling past the cap', new TypeError('Failed to fetch'), BACKOFF_MAX_MS],
    ];
    for (const [what, answer, wait] of steps) {
      const before = w.server.token.length;
      w.server.next.push(answer);
      expect((await rejection(s.accessToken())).code, what).toBe('network');
      expect(w.server.token.length, what).toBe(before + 1);
      w.clock.now += wait - 1;
      expect((await rejection(s.accessToken())).code, what).toBe('network');
      expect(w.server.token.length, `${what}: asked again before ${wait} ms`).toBe(before + 1);
      w.clock.now += 1;
      expect(stored(w), what).toMatchObject({ accessToken: 'at_0', refreshToken: 'brt_0' });
      expect(s.signedIn(), what).toBe(true);
    }
    expect(await s.accessToken()).toBe('at_1');
  });

  it('a back-off never outlasts its cap, even when the device clock is set back', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 - 2 * 3_600_000 });
    const s = appTokenSession(SVC, {}, tab(w).env);
    w.server.next.push(status(503, { 'retry-after': '60' }));
    expect((await rejection(s.accessToken())).code).toBe('network');
    // An hour back: a wait longer than the cap is not one the SDK chose, so it is not honoured.
    w.clock.now -= 3_600_000;
    expect(await s.accessToken()).toBe('at_1');
    expect(w.server.token.length).toBe(2);
  });

  it('while backing off, a still-live access token is handed out, and every tab shares the back-off', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 + 30_000 });
    const A = appTokenSession(SVC, {}, tab(w).env);
    const B = appTokenSession(SVC, {}, tab(w).env);
    w.server.next.push(status(503, { 'retry-after': '60' }));
    expect(await A.accessToken()).toBe('at_0');
    expect(w.server.token.length).toBe(1);
    expect(await A.accessToken()).toBe('at_0');
    expect(await B.accessToken()).toBe('at_0');
    expect(w.server.token.length).toBe(1);
    // Past its expiry and still inside the back-off: no token, and no request.
    w.clock.now = T0 + 30_000;
    expect((await rejection(B.accessToken())).code).toBe('network');
    expect(w.server.token.length).toBe(1);
  });
});

describe('appTokenSession: fetch()', () => {
  it('fetch() retries once after a 401 from the service with a forced refresh, and not twice', async () => {
    const w = world();
    seed(w);
    const s = appTokenSession(SVC, {}, tab(w).env);
    const bearer = () => w.server.service.map((c) => c.headers.get('authorization'));

    // Answered: no refresh.
    expect((await s.fetch(API)).status).toBe(200);
    expect(bearer()).toEqual(['Bearer at_0']);
    expect(w.server.service[0].credentials).toBe('omit');

    // A service that keeps answering 401: one forced refresh, one retry, and its answer returned.
    w.server.service = [];
    w.server.serviceDefault = () => status(401);
    const init = { method: 'POST', body: '{"x":1}', headers: { 'content-type': 'application/json' } };
    const res = await s.fetch(API, init);
    expect(res.status).toBe(401);
    expect(bearer()).toEqual(['Bearer at_0', 'Bearer at_1']);
    expect(w.server.service.map((c) => [c.method, c.headers.get('content-type'), c.body])).toEqual([
      ['POST', 'application/json', { x: 1 }],
      ['POST', 'application/json', { x: 1 }],
    ]);
    expect(w.server.refreshes().length).toBe(1);

    // A 401 once, on a token an ordinary renewal issued: the retry's answer is the caller's.
    w.clock.now += ACCESS_TTL_S * 1000 - REFRESH_SKEW_MS;
    w.server.service = [];
    w.server.serviceDefault = () => status(200);
    w.server.nextService.push(() => status(401));
    expect((await s.fetch(API)).status).toBe(200);
    expect(bearer()).toEqual(['Bearer at_2', 'Bearer at_3']);
    expect(w.server.refreshes().length).toBe(3);
    expect(w.server.reused).toBe(0);
  });

  it('a forced refresh uses a token another tab refreshed meanwhile, rather than refreshing again', async () => {
    const w = world();
    seed(w);
    const s = appTokenSession(SVC, {}, tab(w).env);
    w.server.nextService.push(() => {
      // While this call was out, another tab refreshed.
      seed(w, { accessToken: 'at_9', refreshToken: 'brt_9' });
      return status(401);
    });
    expect((await s.fetch(API)).status).toBe(200);
    expect(w.server.service.map((c) => c.headers.get('authorization'))).toEqual(['Bearer at_0', 'Bearer at_9']);
    expect(w.server.token).toEqual([]);
  });

  it('fetch() rejects sign_in_required when the person must sign in again', async () => {
    const w = world();
    const s = appTokenSession(SVC, {}, tab(w).env);
    expect((await rejection(s.fetch(API))).code).toBe('sign_in_required');
    expect(w.server.service).toEqual([]);

    seed(w);
    w.server.serviceDefault = () => status(401);
    w.server.next.push(status(401));
    expect((await rejection(s.fetch(API))).code).toBe('sign_in_required');
    expect(w.server.service.length).toBe(1);
    expect(stored(w)).toBeNull();
  });
});

describe('appTokenSession: signOut()', () => {
  it('signOut() POSTs /sso/token/revoke with the refresh token and forgets the session even if that fails', async () => {
    const answers: [string, Answer][] = [
      ['200', json(200, {})],
      ['network error', new TypeError('Failed to fetch')],
      ['503', status(503, { 'retry-after': '5' })],
      ['400', json(400, { error: 'invalid_request' })],
    ];
    for (const [what, answer] of answers) {
      const w = world();
      seed(w);
      const { env, lockNames } = tab(w);
      const s = appTokenSession(SVC, {}, env);
      w.server.nextRevoke.push(answer);
      await s.signOut();
      expect(w.server.revoke.length, what).toBe(1);
      const [call] = w.server.revoke;
      expect(call.url, what).toBe(`${AUTH}/sso/token/revoke`);
      expect(call.method, what).toBe('POST');
      expect(call.credentials, what).toBe('omit');
      expect(call.headers.get('content-type'), what).toBe('application/json');
      expect(call.body, what).toEqual({ refresh_token: 'brt_0' });
      // Recording the sign-out and sending it each take this service's lock.
      expect(lockNames.length, what).toBeGreaterThan(0);
      expect(new Set(lockNames), what).toEqual(new Set([LOCK]));
      expect(stored(w), what).toBeNull();
      expect(s.signedIn(), what).toBe(false);
      expect((await rejection(s.accessToken())).code, what).toBe('sign_in_required');
      expect(w.server.token, what).toEqual([]);
    }
    // Nothing held: nothing sent.
    const w = world();
    await appTokenSession(SVC, {}, tab(w).env).signOut();
    expect(w.server.revoke).toEqual([]);
  });

  it('signOut() waits on the lock a refresh in another tab holds, and revokes the token that refresh left', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 });
    const A = appTokenSession(SVC, {}, tab(w).env);
    const B = appTokenSession(SVC, {}, tab(w).env);
    const release = w.server.holdNext();
    const a = A.accessToken();
    await until(() => w.server.token.length === 1);
    const out = B.signOut();
    await settle();
    expect(w.server.revoke).toEqual([]);
    release();
    expect(await a).toBe('at_1');
    await out;
    // The token A's refresh left, not the one B read first: a superseded one would be reuse.
    expect(w.server.revoke.map((c) => c.body)).toEqual([{ refresh_token: 'brt_1' }]);
    expect(w.server.reused).toBe(0);
    expect(stored(w)).toBeNull();
  });
});

describe('appTokenSession: where the session is kept', () => {
  it('storage that throws falls back to memory for the tab and never throws', async () => {
    const cases: [string, { throws?: 'all' | 'writes' }, { storage?: null }][] = [
      ['every call throws', { throws: 'all' }, {}],
      ['writes throw', { throws: 'writes' }, {}],
      ['no storage at all', {}, { storage: null }],
    ];
    for (const [what, worldOpts, tabOpts] of cases) {
      const w = world(worldOpts);
      const { env } = tab(w, tabOpts);
      expect((await signIn(w, env)).accessToken, what).toBe('at_1');
      const s = appTokenSession(SVC, {}, env);
      expect(s.signedIn(), what).toBe(true);
      expect(await s.accessToken(), what).toBe('at_1');
      expect(w.server.refreshes().length, what).toBe(0);
      w.clock.now += ACCESS_TTL_S * 1000 - REFRESH_SKEW_MS;
      expect(await s.accessToken(), what).toBe('at_2');
      expect(await s.accessToken(), what).toBe('at_2');
      expect(w.server.refreshes().map((c) => (c.body as Record<string, string>).refresh_token), what).toEqual(['brt_1']);
      expect(w.store.map.size, what).toBe(0);
      await s.signOut();
      expect(s.signedIn(), what).toBe(false);
      expect(w.server.revoke.map((c) => c.body), what).toEqual([{ refresh_token: 'brt_2' }]);
      expect(w.server.reused, what).toBe(0);
    }
  });

  it("without navigator.locks the session stays in this tab's memory, so no other tab can race its rotations", async () => {
    const w = world();
    const { env } = tab(w, { locks: false });
    await signIn(w, env);
    const s = appTokenSession(SVC, {}, env);
    expect(s.signedIn()).toBe(true);
    // Nothing shared: another tab is not signed in.
    expect(w.store.map.size).toBe(0);
    expect(appTokenSession(SVC, {}, tab(w, { locks: false }).env).signedIn()).toBe(false);
    expect(appTokenSession(SVC, {}, tab(w).env).signedIn()).toBe(false);
    // In the tab, refreshes are single-flight and a sign-out waits for the one in flight.
    w.clock.now += ACCESS_TTL_S * 1000;
    const release = w.server.holdNext();
    const both = Promise.all([s.accessToken(), s.accessToken()]);
    await until(() => w.server.refreshes().length === 1);
    const out = s.signOut();
    await settle();
    expect(w.server.revoke).toEqual([]);
    release();
    expect(await both).toEqual(['at_2', 'at_2']);
    await out;
    expect(w.server.refreshes().length).toBe(1);
    expect(w.server.revoke.map((c) => c.body)).toEqual([{ refresh_token: 'brt_2' }]);
    expect(w.server.reused).toBe(0);
    expect(s.signedIn()).toBe(false);
  });

  it('expiry is computed from expires_in at receipt, not from token claims (a skewed clock still refreshes 60 s early)', async () => {
    for (const deviceAheadMs of [2 * 3_600_000, -2 * 3_600_000]) {
      const what = `device clock ${deviceAheadMs > 0 ? 'ahead' : 'behind'}`;
      const w = world({ claims: true, deviceAheadMs });
      seed(w, { accessExpiresAt: T0 });
      const s = appTokenSession(SVC, {}, tab(w).env);
      const first = await s.accessToken();
      expect(w.server.refreshes().length, what).toBe(1);
      // 60 s and 1 ms left by this device's own clock: still fresh.
      w.clock.now = T0 + ACCESS_TTL_S * 1000 - REFRESH_SKEW_MS - 1;
      expect(await s.accessToken(), what).toBe(first);
      expect(w.server.refreshes().length, what).toBe(1);
      // 60 s left: refreshed.
      w.clock.now += 1;
      expect(await s.accessToken(), what).not.toBe(first);
      expect(w.server.refreshes().length, what).toBe(2);
      expect(stored(w)?.accessExpiresAt, what).toBe(w.clock.now + ACCESS_TTL_S * 1000);
    }
  });

  it('windowSessionEnv keeps one env per window, binds navigator.locks, and drops storage the browser refuses', async () => {
    const lockThis: unknown[] = [];
    const locks = {
      request(this: unknown, name: string, cb: (l: unknown) => unknown) {
        lockThis.push(this);
        return Promise.resolve(cb({ name }));
      },
    };
    const { storage } = memoryStorage();
    const win = { localStorage: storage, navigator: { locks }, fetch: async () => status(200) } as unknown as Window;
    const env = windowSessionEnv(win);
    expect(windowSessionEnv(win)).toBe(env);
    expect(env.storage).toBe(storage);
    expect(await env.locks!.request('x', async () => 7)).toBe(7);
    expect(lockThis).toEqual([locks]);

    const refused = {
      get localStorage(): Storage {
        throw new Error('SecurityError: storage is blocked');
      },
      navigator: {},
      fetch: async () => status(200),
    } as unknown as Window;
    const bare = windowSessionEnv(refused);
    expect(bare.storage).toBeNull();
    expect(bare.locks ?? null).toBeNull();
  });

  it('a malformed service is refused at once', () => {
    expect(() => appTokenSession('notes', {}, tab(world()).env)).toThrow(BoogyError);
  });
});

describe('appTokenSession: failures, limits and lifetimes', () => {
  it('a write that fails mid-session clears the shared copy, so no other tab presents a superseded token', async () => {
    // Fails once (the old pair was what filled the store): removing it lets the retry land.
    // Fails for good: the tab keeps the session in memory and other tabs see it signed out.
    for (const failWrites of [1, Infinity]) {
      const what = `${failWrites} failed write(s)`;
      const w = world();
      seed(w, { accessExpiresAt: T0 });
      const A = appTokenSession(SVC, {}, tab(w).env);
      w.store.control.failWrites = failWrites;
      expect(await A.accessToken(), what).toBe('at_1');
      w.store.control.failWrites = 0;
      for (const other of [tab(w).env, tab(w).env]) {
        const s = appTokenSession(SVC, {}, other);
        if (failWrites === 1) {
          expect(await s.accessToken(), what).toBe('at_1');
        } else {
          expect(s.signedIn(), what).toBe(false);
          expect((await rejection(s.accessToken())).code, what).toBe('sign_in_required');
        }
      }
      expect(w.server.reused, what).toBe(0);
      expect(w.server.refreshes().length, what).toBe(1);
      expect(stored(w)?.refreshToken ?? null, what).toBe(failWrites === 1 ? 'brt_1' : null);
      // The tab that renewed is still signed in.
      expect(await A.accessToken(), what).toBe('at_1');
    }
  });

  it('a route that always answers 401 costs at most one forced renewal per token lineage', async () => {
    const w = world();
    seed(w);
    const s = appTokenSession(SVC, {}, tab(w).env);
    w.server.serviceDefault = () => status(401);
    for (let i = 0; i < 50; i++) expect((await s.fetch(API)).status).toBe(401);
    expect(w.server.refreshes().length).toBe(1);
    expect(stored(w)).toMatchObject({ accessToken: 'at_1', forced: true });
    // An ordinary renewal clears the mark and starts a new lineage: one more forced renewal.
    w.clock.now += ACCESS_TTL_S * 1000 - REFRESH_SKEW_MS;
    expect(await s.accessToken()).toBe('at_2');
    expect(stored(w)).not.toHaveProperty('forced');
    for (let i = 0; i < 50; i++) expect((await s.fetch(API)).status).toBe(401);
    expect(w.server.refreshes().length).toBe(3);
    expect(w.server.reused).toBe(0);
  });

  it('with apiOrigin set, fetch() sends nothing to another origin, and works on its own', async () => {
    const w = world();
    seed(w);
    const s = appTokenSession(SVC, { apiOrigin: 'https://dave.boogy.app' }, tab(w).env);
    for (const url of ['https://evil.example/collect', 'https://dave.boogy.app.evil.example/x', '/notes/items', 'not a url']) {
      const e = await rejection(s.fetch(url));
      expect(e.code, url).toBe('url_not_allowed');
      expect(e.app, url).toBe(SVC);
    }
    expect(await rejection(s.fetch(new URL('https://evil.example/x')))).toMatchObject({ code: 'url_not_allowed' });
    expect(w.server.service).toEqual([]);
    expect(w.server.token).toEqual([]);
    expect((await s.fetch(API)).status).toBe(200);
    expect((await s.fetch(new URL(API))).status).toBe(200);
    expect(w.server.service.map((c) => c.headers.get('authorization'))).toEqual(['Bearer at_0', 'Bearer at_0']);
    // An apiOrigin that is not an origin is refused at once.
    for (const bad of ['dave.boogy.app', 'https://dave.boogy.app/notes', 'javascript:alert(1)']) {
      expect(() => appTokenSession(SVC, { apiOrigin: bad }, tab(w).env), bad).toThrow(BoogyError);
    }
    // A trailing slash is the same origin.
    const slash = appTokenSession(SVC, { apiOrigin: 'https://dave.boogy.app/' }, tab(w).env);
    expect((await slash.fetch(API)).status).toBe(200);
  });

  it('a URL object is checked and sent as one copy: changing it afterwards cannot redirect the token', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 });
    const s = appTokenSession(SVC, { apiOrigin: 'https://dave.boogy.app' }, tab(w).env);
    const url = new URL(API);
    const sent = s.fetch(url);
    // While the renewal is out, the caller's URL object changes.
    url.host = 'evil.example';
    expect((await sent).status).toBe(200);
    expect(w.server.service.map((c) => c.url)).toEqual([API]);
  });

  it('a readable Retry-After sets the wait, up to the cap', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 - 1 });
    const s = appTokenSession(SVC, {}, tab(w).env);
    w.server.next.push(status(503, { 'retry-after': '17' }));
    expect((await rejection(s.accessToken())).code).toBe('network');
    w.clock.now += 16_999;
    expect((await rejection(s.accessToken())).code).toBe('network');
    expect(w.server.token.length).toBe(1);
    w.clock.now += 1;
    expect(await s.accessToken()).toBe('at_1');
    expect(w.server.token.length).toBe(2);
  });

  it('a renewal that hangs times out as a transient failure, keeps the session, and releases the lock', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 - 1 });
    const A = tab(w);
    const s = appTokenSession(SVC, {}, A.env);
    w.server.holdNext(); // never released
    const renewal = s.accessToken();
    await until(() => w.server.token.length === 1);
    expect(A.deadlines.map((d) => d.ms)).toEqual([TOKEN_REQUEST_TIMEOUT_MS]);
    A.deadlines[0].abort();
    expect((await rejection(renewal)).code).toBe('network');
    expect(stored(w)).toMatchObject({ accessToken: 'at_0', refreshToken: 'brt_0' });
    // The lock is free: another tab signs out at once.
    await appTokenSession(SVC, {}, tab(w).env).signOut();
    expect(w.server.revoke.map((c) => c.body)).toEqual([{ refresh_token: 'brt_0' }]);
    expect(w.server.reused).toBe(0);
  });

  it('every request to the token endpoints carries a 10 s deadline', async () => {
    // The platform hands a lost answer its replacement for one minute after it
    // rotated. A 10 s deadline leaves room for about four retries inside that
    // minute; a 30 s one spent half of it on the first attempt.
    expect(TOKEN_REQUEST_TIMEOUT_MS).toBe(10_000);
    const w = world();
    const B = tab(w);
    await signIn(w, B.env);
    const s = appTokenSession(SVC, {}, B.env);
    w.clock.now += ACCESS_TTL_S * 1000;
    await s.accessToken();
    await s.signOut();
    expect(B.deadlines.map((d) => d.ms)).toEqual([
      10_000, // the code redeem
      10_000, // the renewal
      10_000, // the sign-out
    ]);
  });

  it('without an injected deadline, a token request is aborted at 10 s and not before', () => {
    const env: SessionEnv = { storage: null, fetch: (async () => status(200)) as typeof fetch, now: () => T0 };
    // Where the browser has AbortSignal.timeout, it is asked for exactly 10 s.
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      requestDeadline(env);
      expect(timeout).toHaveBeenCalledWith(10_000);
    } finally {
      timeout.mockRestore();
    }
    // Where it has none, the fallback timer fires at 10 s.
    const original = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout');
    Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true, writable: true });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const signal = requestDeadline(env);
      vi.advanceTimersByTime(9_999);
      expect(signal.aborted).toBe(false);
      vi.advanceTimersByTime(1);
      expect(signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
      if (original) Object.defineProperty(AbortSignal, 'timeout', original);
    }
  });

  it('a refresh token past its expiry is forgotten with no request sent', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 - 1, refreshExpiresAt: T0 });
    const s = appTokenSession(SVC, {}, tab(w).env);
    expect((await rejection(s.accessToken())).code).toBe('sign_in_required');
    expect(w.server.token).toEqual([]);
    expect(stored(w)).toBeNull();
  });

  it('sign-out forgets before it revokes, so a renewal racing the revoke never presents the token', async () => {
    const w = world();
    const { env } = tab(w, { locks: false });
    await signIn(w, env);
    const s = appTokenSession(SVC, {}, env);
    w.clock.now += ACCESS_TTL_S * 1000;
    const release = w.server.holdNextRevoke();
    const out = s.signOut();
    await until(() => w.server.revoke.length === 1);
    expect((await rejection(s.accessToken())).code).toBe('sign_in_required');
    release();
    await out;
    expect(w.server.refreshes()).toEqual([]);
    expect(w.server.reused).toBe(0);
  });

  it('a corrupted or hostile stored session is neither used nor a crash', async () => {
    const hostile: unknown[] = [
      'not json',
      'null',
      '[]',
      '"brt_0"',
      { ...record(), authOrigin: 1 },
      { ...record(), authOrigin: 'https://evil.example/collect' },
      { ...record(), authOrigin: 'javascript:alert(1)' },
      { ...record(), authOrigin: 'http://evil.example' },
      { ...record(), authOrigin: 'https://auth.boogy.app/' },
      { ...record(), accessToken: 42 },
      { ...record(), refreshToken: '' },
      { ...record(), accessExpiresAt: 'soon' },
      { ...record(), refreshExpiresAt: null },
      { ...record(), retryAt: 'never' },
      { ...record(), failures: Number.NaN },
    ];
    for (const value of hostile) {
      const what = JSON.stringify(value);
      const w = world();
      w.store.map.set(KEY, typeof value === 'string' ? value : JSON.stringify(value));
      const s = appTokenSession(SVC, {}, tab(w).env);
      expect(s.signedIn(), what).toBe(false);
      expect((await rejection(s.accessToken())).code, what).toBe('sign_in_required');
      expect((await rejection(s.fetch(API))).code, what).toBe('sign_in_required');
      expect(w.server.token, what).toEqual([]);
      expect(w.server.service, what).toEqual([]);
    }
    // Loopback over plain http is a development platform, and is accepted.
    for (const authOrigin of ['http://auth.localhost:3000', 'http://localhost:3000', 'http://127.0.0.1:8080']) {
      const w = world();
      seed(w, { authOrigin });
      expect(appTokenSession(SVC, {}, tab(w).env).signedIn(), authOrigin).toBe(true);
    }
  });

  it('a negative failure count cannot shorten the back-off', async () => {
    const w = world();
    w.store.map.set(KEY, JSON.stringify({ ...record({ accessExpiresAt: T0 - 1 }), failures: -50, retryAt: 0 }));
    const s = appTokenSession(SVC, {}, tab(w).env);
    w.server.next.push(new TypeError('Failed to fetch'));
    expect((await rejection(s.accessToken())).code).toBe('network');
    w.clock.now += BACKOFF_BASE_MS - 1;
    expect((await rejection(s.accessToken())).code).toBe('network');
    expect(w.server.token.length).toBe(1);
    expect(stored(w)).toMatchObject({ failures: 1 });
  });

  it('a sign-in finishing while another tab renews is written after that renewal, not under it', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 });
    const A = appTokenSession(SVC, {}, tab(w).env);
    const release = w.server.holdNext();
    const renewal = A.accessToken();
    await until(() => w.server.token.length === 1);
    // Another tab finishes a new sign-in while A's renewal holds the lock.
    const B = tab(w);
    const signedIn = signIn(w, B.env);
    await until(() => w.server.token.length === 2);
    await settle();
    expect(stored(w)).toMatchObject({ refreshToken: 'brt_0' });
    release();
    // (This fake platform keeps one sign-in, so A's renewal of the old one is refused.)
    await renewal.catch(() => undefined);
    await signedIn;
    // The new sign-in is what stays.
    expect(stored(w)).toMatchObject({ accessToken: 'at_1', refreshToken: 'brt_1' });
  });

  it('a lock the browser refuses to grant is a network error, and the session is kept', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 });
    const refusing: SessionLocks = { request: () => Promise.reject(new DOMException('not allowed', 'InvalidStateError')) };
    const s = appTokenSession(SVC, {}, tab(w, { locks: refusing }).env);
    const e = await rejection(s.accessToken());
    expect(e.code).toBe('network');
    expect(e.app).toBe(SVC);
    expect(stored(w)).toMatchObject({ refreshToken: 'brt_0' });
    expect(w.server.token).toEqual([]);
  });
});

describe('appTokenSession: a sign-out the platform did not receive', () => {
  it('is kept, and retried on the next page load until a 200 clears it', async () => {
    const w = world();
    seed(w);
    const first = appTokenSession(SVC, {}, tab(w).env);
    w.server.nextRevoke.push(new TypeError('Failed to fetch'));
    await first.signOut();
    expect(stored(w)).toBeNull();
    expect(w.server.revoke.length).toBe(1);
    expect(w.server.revoke[0].keepalive).toBe(true);
    expect(pending(w)).toEqual([pendingEntry('brt_0', { failures: 1, retryAt: T0 + BACKOFF_BASE_MS })]);
    // Too early: nothing is sent.
    appTokenSession(SVC, {}, tab(w).env);
    await settle();
    expect(w.server.revoke.length).toBe(1);
    // The next page load, once the wait is over.
    w.clock.now += BACKOFF_BASE_MS;
    appTokenSession(SVC, {}, tab(w).env);
    await until(() => w.server.revoke.length === 2);
    await settle();
    expect(w.server.revoke[1].body).toEqual({ refresh_token: 'brt_0' });
    // keepalive is for the sign-out itself, as the page may be closing; a retry is not.
    expect(w.server.revoke[1].keepalive).toBeFalsy();
    expect(pending(w)).toBeNull();
    expect(w.server.reused).toBe(0);
  });

  it('honours a readable Retry-After, and a readable 400 also clears it', async () => {
    const w = world();
    w.store.map.set(PENDING, JSON.stringify([pendingEntry('brt_0')]));
    w.server.nextRevoke.push(status(503, { 'retry-after': '7' }));
    appTokenSession(SVC, {}, tab(w).env);
    await until(() => w.server.revoke.length === 1);
    await settle();
    expect(pending(w)).toEqual([pendingEntry('brt_0', { failures: 1, retryAt: T0 + 7_000 })]);
    w.clock.now += 6_999;
    appTokenSession(SVC, {}, tab(w).env);
    await settle();
    expect(w.server.revoke.length).toBe(1);
    w.clock.now += 1;
    w.server.nextRevoke.push(json(400, { error: 'invalid_request' }));
    appTokenSession(SVC, {}, tab(w).env);
    await until(() => w.server.revoke.length === 2);
    await settle();
    expect(pending(w)).toBeNull();
  });

  it('an expired entry is dropped without a request', async () => {
    const w = world();
    w.store.map.set(PENDING, JSON.stringify([pendingEntry('brt_old', { refreshExpiresAt: T0 })]));
    appTokenSession(SVC, {}, tab(w).env);
    await settle();
    await settle();
    expect(w.server.revoke).toEqual([]);
    expect(pending(w)).toBeNull();
  });

  it('the list holds at most 4, dropping the oldest', async () => {
    const w = world();
    const waiting = { retryAt: T0 + 30_000, failures: 3 };
    const older = ['brt_a', 'brt_b', 'brt_c', 'brt_d'].map((t) => pendingEntry(t, waiting));
    w.store.map.set(PENDING, JSON.stringify(older));
    seed(w);
    const s = appTokenSession(SVC, {}, tab(w).env);
    w.server.nextRevoke.push(new TypeError('Failed to fetch'));
    await s.signOut();
    expect(MAX_PENDING_REVOKES).toBe(4);
    expect(pending(w)?.map((e) => e.refreshToken)).toEqual(['brt_b', 'brt_c', 'brt_d', 'brt_0']);
    // Only the one that was due went out.
    expect(w.server.revoke.map((c) => c.body)).toEqual([{ refresh_token: 'brt_0' }]);
  });

  it('the renewal path never presents a token owed a sign-out, and a new sign-in keeps the list', async () => {
    const w = world();
    const owed = [pendingEntry('brt_owed', { retryAt: T0 + 30_000, failures: 2 })];
    w.store.map.set(PENDING, JSON.stringify(owed));
    const { env } = tab(w);
    await signIn(w, env);
    expect(pending(w)).toEqual(owed);
    // Later, with the owed sign-out still waiting out its back-off, the access token runs out.
    w.clock.now += ACCESS_TTL_S * 1000;
    const stillOwed = [pendingEntry('brt_owed', { retryAt: w.clock.now + 30_000, failures: 2 })];
    w.store.map.set(PENDING, JSON.stringify(stillOwed));
    const s = appTokenSession(SVC, {}, env);
    expect(await s.accessToken()).toBe('at_2');
    const presented = w.server.token.map((c) => JSON.stringify(c.body));
    expect(presented.some((b) => b.includes('brt_owed'))).toBe(false);
    expect(w.server.refreshes().map((c) => (c.body as Record<string, string>).refresh_token)).toEqual(['brt_1']);
    expect(pending(w)).toEqual(stillOwed);
    expect(w.server.revoke).toEqual([]);
  });

  it('a sign-out with no session still sends what is owed', async () => {
    const w = world();
    w.store.map.set(PENDING, JSON.stringify([pendingEntry('brt_0', { retryAt: T0 + 30_000, failures: 1 })]));
    const s = appTokenSession(SVC, {}, tab(w).env);
    w.clock.now += 30_000;
    await s.signOut();
    expect(w.server.revoke.map((c) => c.body)).toEqual([{ refresh_token: 'brt_0' }]);
    expect(pending(w)).toBeNull();
  });
});

describe('completeAppToken: a sign-in that replaces another', () => {
  it("signs out the sign-in it replaces, with the token that sign-in holds now, and raises no alarm", async () => {
    const w = world();
    const { env } = tab(w);
    await signIn(w, env);
    // The first sign-in renews once: the token it holds now is brt_2, and brt_1 is retired.
    w.clock.now += ACCESS_TTL_S * 1000;
    expect(await appTokenSession(SVC, {}, env).accessToken()).toBe('at_2');
    // A second sign-in on the same website, for the same service.
    await signIn(w, env);
    await until(() => w.server.revoke.length === 1);
    await settle();
    // The first sign-in is revoked with its CURRENT token: presenting the retired one would be reuse.
    expect(w.server.revoke.map((c) => c.body)).toEqual([{ refresh_token: 'brt_2' }]);
    expect(pending(w)).toBeNull();
    expect(stored(w)).toMatchObject({ accessToken: 'at_3', refreshToken: 'brt_3' });
    expect(w.server.reused).toBe(0);
    // The new sign-in renews as usual.
    w.clock.now += ACCESS_TTL_S * 1000;
    expect(await appTokenSession(SVC, {}, env).accessToken()).toBe('at_4');
    expect(w.server.reused).toBe(0);
  });

  it('a sign-in finishing while another tab renews owes the token that renewal leaves', async () => {
    const pair = (access: string, refresh: string) =>
      json(200, { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL_S, refresh_token: refresh, refresh_expires_in: REFRESH_TTL_S });
    const w = world();
    seed(w, { accessExpiresAt: T0 });
    const A = appTokenSession(SVC, {}, tab(w).env);
    const release = w.server.holdNext();
    // The second sign-in's redeem is answered first (A's renewal is held), then A's renewal.
    w.server.next.push(pair('at_b', 'brt_b'), pair('at_a', 'brt_a'));
    const renewal = A.accessToken();
    await until(() => w.server.token.length === 1);
    const signedIn = signIn(w, tab(w).env);
    await until(() => w.server.token.length === 2);
    await settle();
    // The new pair waits on the lock A's renewal holds.
    expect(stored(w)).toMatchObject({ refreshToken: 'brt_0' });
    release();
    expect(await renewal).toBe('at_a');
    await signedIn;
    await until(() => w.server.revoke.length === 1);
    await settle();
    // brt_0 was retired by A's renewal: the sign-out names brt_a.
    expect(w.server.revoke.map((c) => c.body)).toEqual([{ refresh_token: 'brt_a' }]);
    expect(stored(w)).toMatchObject({ refreshToken: 'brt_b' });
  });

  it('a sign-out the platform does not receive is owed, and sent again later', async () => {
    const w = world();
    const { env } = tab(w);
    await signIn(w, env);
    w.server.nextRevoke.push(new TypeError('Failed to fetch'));
    await signIn(w, env);
    await until(() => w.server.revoke.length === 1);
    await settle();
    expect(pending(w)).toEqual([pendingEntry('brt_1', { failures: 1, retryAt: T0 + BACKOFF_BASE_MS })]);
    w.clock.now += BACKOFF_BASE_MS;
    appTokenSession(SVC, {}, env);
    await until(() => w.server.revoke.length === 2);
    await settle();
    expect(w.server.revoke.map((c) => c.body)).toEqual([{ refresh_token: 'brt_1' }, { refresh_token: 'brt_1' }]);
    expect(pending(w)).toBeNull();
    expect(stored(w)).toMatchObject({ refreshToken: 'brt_2' });
  });

  it('a replaced sign-in that has already lapsed is sent nothing', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 - 1, refreshExpiresAt: T0 });
    const { env } = tab(w);
    await signIn(w, env);
    await settle();
    await settle();
    expect(w.server.revoke).toEqual([]);
    expect(pending(w)).toBeNull();
    expect(stored(w)).toMatchObject({ refreshToken: 'brt_1' });
  });
});

describe('appTokenSession: one key failing to store leaves every other key shared', () => {
  /** In tab `env`, service Y's sign-out record cannot be written: Y alone falls back to memory. */
  async function failY(w: World, env: SessionEnv) {
    w.store.map.set(KEY_Y, JSON.stringify(record({ accessToken: 'at_y', refreshToken: 'brt_y' })));
    w.store.control.failKeys.add(PENDING_Y);
    await appTokenSession(SVC_Y, {}, env).signOut();
  }

  it("another service's failed write does not keep a renewal out of shared storage", async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 });
    const A = tab(w);
    const X = appTokenSession(SVC, {}, A.env);
    const release = w.server.holdNext();
    const renewal = X.accessToken();
    await until(() => w.server.token.length === 1);
    await failY(w, A.env);
    release();
    expect(await renewal).toBe('at_1');
    expect(stored(w)).toMatchObject({ accessToken: 'at_1', refreshToken: 'brt_1' });
    expect(await appTokenSession(SVC, {}, tab(w).env).accessToken()).toBe('at_1');
    expect(w.server.reused).toBe(0);
  });

  it('nor a renewal that failed on the network: the one live copy stays shared', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 });
    const A = tab(w);
    const X = appTokenSession(SVC, {}, A.env);
    const release = w.server.holdNext();
    w.server.next.push(new TypeError('Failed to fetch'));
    const renewal = X.accessToken();
    await until(() => w.server.token.length === 1);
    await failY(w, A.env);
    release();
    expect((await rejection(renewal)).code).toBe('network');
    // The back-off was written where every tab reads it.
    expect(stored(w)).toMatchObject({ refreshToken: 'brt_0', failures: 1 });
    w.clock.now += BACKOFF_BASE_MS;
    expect(await X.accessToken()).toBe('at_1');
    expect(stored(w)).toMatchObject({ accessToken: 'at_1', refreshToken: 'brt_1' });
    expect(await appTokenSession(SVC, {}, tab(w).env).accessToken()).toBe('at_1');
    expect(w.server.reused).toBe(0);
  });

  it('a tab keeping one service in memory still reads and writes another service in shared storage', async () => {
    const w = world();
    const A = tab(w);
    await failY(w, A.env);
    // Another tab signs in to X: this tab sees it.
    seed(w);
    const X = appTokenSession(SVC, {}, A.env);
    expect(X.signedIn()).toBe(true);
    expect(await X.accessToken()).toBe('at_0');
    // And this tab's renewal of X goes where the other tabs read it.
    w.clock.now += 10 * 60_000;
    expect(await X.accessToken()).toBe('at_1');
    expect(stored(w)).toMatchObject({ refreshToken: 'brt_1' });
  });

  it('a shared copy a failed write could not remove is removed by the next write this tab keeps in memory', async () => {
    const w = world();
    seed(w, { accessExpiresAt: T0 });
    const X = appTokenSession(SVC, {}, tab(w).env);
    w.store.control.failKeys.add(KEY);
    // The store refuses the removal at the failure, and the one right after it.
    w.store.control.failRemoves = 2;
    expect(await X.accessToken()).toBe('at_1');
    expect(stored(w)).toMatchObject({ refreshToken: 'brt_0' });
    // The next write this tab keeps in memory removes it.
    w.clock.now += ACCESS_TTL_S * 1000;
    expect(await X.accessToken()).toBe('at_2');
    expect(stored(w)).toBeNull();
    expect(appTokenSession(SVC, {}, tab(w).env).signedIn()).toBe(false);
    expect(w.server.reused).toBe(0);
  });

  it("a tab that empties its own owed sign-outs in memory leaves other tabs' owed sign-outs shared", async () => {
    const w = world();
    seed(w);
    const A = tab(w);
    w.store.control.failKeys.add(PENDING);
    w.server.nextRevoke.push(new TypeError('Failed to fetch'));
    // Owed, and kept in this tab's memory.
    await appTokenSession(SVC, {}, A.env).signOut();
    w.store.control.failKeys.delete(PENDING);
    // Another tab's owed sign-out lands in shared storage.
    const others = [pendingEntry('brt_b', { retryAt: T0 + 30_000, failures: 1 })];
    w.store.map.set(PENDING, JSON.stringify(others));
    // This tab's own is sent and settled.
    w.clock.now += BACKOFF_BASE_MS;
    appTokenSession(SVC, {}, A.env);
    await until(() => w.server.revoke.length === 2);
    await settle();
    expect(w.server.revoke.map((c) => c.body)).toEqual([{ refresh_token: 'brt_0' }, { refresh_token: 'brt_0' }]);
    expect(pending(w)).toEqual(others);
  });
});

describe('appTokenSession: sending owed sign-outs never holds up a renewal', () => {
  it('a renewal in another tab does not wait for a sign-out the platform is slow to answer', async () => {
    const w = world();
    w.store.map.set(PENDING, JSON.stringify(['brt_a', 'brt_b', 'brt_c'].map((t) => pendingEntry(t))));
    seed(w, { accessExpiresAt: T0 });
    w.server.hangRevokes();
    // This tab starts sending what is owed; the platform does not answer.
    appTokenSession(SVC, {}, tab(w).env);
    await until(() => w.server.revoke.length === 1);
    let renewed: string | undefined;
    void appTokenSession(SVC, {}, tab(w).env)
      .accessToken()
      .then((t) => (renewed = t));
    await until(() => renewed !== undefined);
    expect(renewed).toBe('at_1');
    expect(w.server.reused).toBe(0);
  });

  it('a sign-out one tab is sending is not sent again by another meanwhile', async () => {
    const w = world();
    w.store.map.set(PENDING, JSON.stringify([pendingEntry('brt_a')]));
    w.server.hangRevokes();
    appTokenSession(SVC, {}, tab(w).env);
    await until(() => w.server.revoke.length === 1);
    appTokenSession(SVC, {}, tab(w).env);
    await settle();
    await settle();
    expect(w.server.revoke.length).toBe(1);
  });

  it('a claim left by a tab that went away lapses, and the sign-out is sent again', async () => {
    const w = world();
    w.store.map.set(PENDING, JSON.stringify([{ ...pendingEntry('brt_a'), claimedUntil: T0 + 10_000 }]));
    appTokenSession(SVC, {}, tab(w).env);
    await settle();
    expect(w.server.revoke).toEqual([]);
    w.clock.now += 10_000;
    appTokenSession(SVC, {}, tab(w).env);
    await until(() => w.server.revoke.length === 1);
    await settle();
    expect(pending(w)).toBeNull();
  });
});
