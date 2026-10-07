import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TOKEN_KEY,
  appTokenAuthorizeUrl,
  completeAppToken,
  parseTokenLanding,
  requestAppToken,
  type TokenEnv,
} from './flow';
import { BoogyError } from '../errors';
import { s256Challenge } from '../internal/pkce';
import { SESSION_KEY_PREFIX, appTokenSession, type SessionEnv } from './session';

const AUTH = 'https://auth.boogy.app';
const PAGE = 'https://app.example.com';

/** Everything a token trip touches, recorded in one ordered log so a test can
 *  read what happened before what. */
function page(href: string, kept: Record<string, string> = {}, answer: () => Response | Error = granted) {
  const log: string[] = [];
  const store = new Map(Object.entries(kept));
  const posts: { url: string; init: RequestInit }[] = [];
  const url = new URL(href);
  let current = url.href;
  const env: TokenEnv = {
    location: {
      origin: url.origin,
      get href() {
        return current;
      },
      pathname: url.pathname,
      search: url.search,
      get hash() {
        return new URL(current).hash;
      },
      assign: (u: string | URL) => void log.push(`assign ${String(u)}`),
    },
    history: {
      state: null,
      replaceState: (_s: unknown, _t: string, u?: string | URL | null) => {
        current = new URL(String(u), current).href;
        log.push(`replaceState ${String(u)}`);
      },
    },
    storage: {
      getItem: (k) => {
        log.push(`read ${k}`);
        return store.get(k) ?? null;
      },
      setItem: (k, v) => {
        log.push(`write ${k}`);
        store.set(k, v);
      },
      removeItem: (k) => {
        log.push(`remove ${k}`);
        store.delete(k);
      },
    },
    fetch: (async (input: string | URL, init: RequestInit) => {
      const u = String(input);
      log.push(`fetch ${u} (address bar: ${current})`);
      posts.push({ url: u, init });
      const r = answer();
      if (r instanceof Error) throw r;
      return r;
    }) as unknown as typeof fetch,
    now: () => 1_000_000,
  };
  // Where the session is kept: this website's localStorage, shared by its tabs.
  const held = new Map<string, string>();
  const session: SessionEnv = {
    storage: {
      getItem: (k) => held.get(k) ?? null,
      setItem: (k, v) => void held.set(k, v),
      removeItem: (k) => void held.delete(k),
    },
    fetch: env.fetch,
    now: env.now,
    locks: { request: async (_name, cb) => cb(null) },
  };
  return { env, log, posts, store, session, held };
}

const REFRESH = `brt_${'r'.repeat(43)}`;

function granted(): Response {
  return new Response(
    JSON.stringify({
      access_token: 'tok-1',
      token_type: 'Bearer',
      expires_in: 900,
      refresh_token: REFRESH,
      refresh_expires_in: 2_592_000,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

const TRIP = { state: 'st-1', verifier: 'v'.repeat(43), authOrigin: AUTH, service: 'dave/notes' };
const kept = () => ({ [TOKEN_KEY]: JSON.stringify(TRIP) });

async function rejection(p: Promise<unknown>): Promise<BoogyError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(BoogyError);
    return e as BoogyError;
  }
  throw new Error('expected a rejection');
}

describe('requestAppToken', () => {
  it('keeps the verifier and state here, then goes to /authorize?mode=token for this page', async () => {
    const p = page(`${PAGE}/notes/?x=1#old`);
    await requestAppToken({ service: 'dave/notes', authOrigin: AUTH, redirect: `${PAGE}/cb?x=1` }, p.env);
    const kept = JSON.parse(p.store.get(TOKEN_KEY) ?? 'null');
    expect(kept).toMatchObject({ authOrigin: AUTH, service: 'dave/notes' });
    expect(kept.verifier.length).toBeGreaterThanOrEqual(43);
    expect(p.log.indexOf(`write ${TOKEN_KEY}`)).toBeLessThan(p.log.findIndex((l) => l.startsWith('assign ')));
    const went = new URL(p.log.find((l) => l.startsWith('assign '))!.slice('assign '.length));
    expect(`${went.origin}${went.pathname}`).toBe(`${AUTH}/authorize`);
    expect(Object.fromEntries(went.searchParams)).toEqual({
      mode: 'token',
      aud: 'boogy://dave/services/notes',
      client_origin: PAGE,
      redirect: `${PAGE}/cb?x=1`,
      code_challenge: await s256Challenge(kept.verifier),
      state: kept.state,
    });
    expect(went.toString()).not.toContain(kept.verifier);
  });

  it('sends the return URL exactly as written, never a normalised spelling of it', async () => {
    // The platform compares it byte for byte with the service's registered
    // URLs, so the SDK must not turn an unregistered spelling into a
    // registered one.
    for (const written of [`${PAGE}/a/../cb`, `${PAGE}/cb?b=2&a=1`, `${PAGE}`]) {
      const p = page(`${PAGE}/`);
      await requestAppToken({ service: 'dave/notes', authOrigin: AUTH, redirect: written }, p.env);
      const went = new URL(p.log.find((l) => l.startsWith('assign '))!.slice('assign '.length));
      expect(went.searchParams.get('redirect')).toBe(written);
    }
  });

  it('starts nothing for a return URL that is missing, relative, carries a fragment, or is on another origin', async () => {
    for (const redirect of [undefined, '', '/cb', 'cb', `${PAGE}/cb#x`, 'https://evil.example/cb', `${PAGE}:8443/cb`]) {
      const p = page(`${PAGE}/`);
      const opts = { service: 'dave/notes', authOrigin: AUTH, redirect } as unknown as Parameters<typeof requestAppToken>[0];
      expect((await rejection(requestAppToken(opts, p.env))).code, String(redirect)).toBe('sign_in_unavailable');
      expect(p.log.filter((l) => l.startsWith('assign ')), String(redirect)).toEqual([]);
      expect(p.store.size, String(redirect)).toBe(0);
    }
  });

  it('starts nothing for a malformed service, a missing auth origin, or no storage', async () => {
    const bad = page(`${PAGE}/`);
    const cb = `${PAGE}/cb`;
    expect((await rejection(requestAppToken({ service: 'notes', authOrigin: AUTH, redirect: cb }, bad.env))).code).toBe(
      'app_not_found',
    );
    // No `authOrigin`, and no platform config loaded on this page.
    expect((await rejection(requestAppToken({ service: 'dave/notes', redirect: cb }, bad.env))).code).toBe(
      'config_unavailable',
    );
    expect(
      (await rejection(requestAppToken({ service: 'dave/notes', authOrigin: 'javascript:alert(1)', redirect: cb }, bad.env)))
        .code,
    ).toBe('config_unavailable');
    expect(bad.log.filter((l) => l.startsWith('assign '))).toEqual([]);
    expect(bad.store.size).toBe(0);

    const noStorage = page(`${PAGE}/`);
    noStorage.env.storage = null;
    expect(
      (await rejection(requestAppToken({ service: 'dave/notes', authOrigin: AUTH, redirect: `${PAGE}/cb` }, noStorage.env)))
        .code,
    ).toBe('sign_in_unavailable');
    expect(noStorage.log.filter((l) => l.startsWith('assign '))).toEqual([]);
  });

  it('starts nothing for an auth origin a session could not be kept for', async () => {
    // A session is kept only for a bare origin a token may be sent to: https, or http on loopback.
    for (const authOrigin of ['http://auth.example.com', `${AUTH}/sso`, 'ftp://auth.example.com']) {
      const p = page(`${PAGE}/`);
      const opts = { service: 'dave/notes', authOrigin, redirect: `${PAGE}/cb` };
      expect((await rejection(requestAppToken(opts, p.env))).code, authOrigin).toBe('config_unavailable');
      expect(p.log.filter((l) => l.startsWith('assign ')), authOrigin).toEqual([]);
    }
    for (const authOrigin of ['http://auth.localhost:3000', `${AUTH}/`]) {
      const p = page(`${PAGE}/`);
      await requestAppToken({ service: 'dave/notes', authOrigin, redirect: `${PAGE}/cb` }, p.env);
      expect(p.log.filter((l) => l.startsWith('assign ')).length, authOrigin).toBe(1);
    }
  });

  it('builds the authorize URL from its parts', () => {
    expect(
      appTokenAuthorizeUrl({
        authOrigin: `${AUTH}/`,
        owner: 'dave',
        service: 'notes',
        clientOrigin: PAGE,
        redirect: `${PAGE}/cb`,
        state: 's',
        challenge: 'c',
      }),
    ).toBe(
      `${AUTH}/authorize?mode=token&aud=boogy%3A%2F%2Fdave%2Fservices%2Fnotes&client_origin=https%3A%2F%2Fapp.example.com&redirect=https%3A%2F%2Fapp.example.com%2Fcb&code_challenge=c&state=s`,
    );
  });
});

describe('completeAppToken', () => {
  it('drops the fragment before its first request, and checks state before any POST', async () => {
    const p = page(`${PAGE}/cb?x=1#state=st-1&code=c-1`, kept());
    await completeAppToken(p.env, p.session);
    const cleared = p.log.findIndex((l) => l.startsWith('replaceState '));
    const stateRead = p.log.indexOf(`read ${TOKEN_KEY}`);
    const firstFetch = p.log.findIndex((l) => l.startsWith('fetch '));
    expect(cleared).toBeGreaterThanOrEqual(0);
    expect(stateRead).toBeGreaterThan(cleared);
    expect(firstFetch).toBeGreaterThan(stateRead);
    expect(p.log[cleared]).toBe('replaceState /cb?x=1');
    expect(p.log[firstFetch]).not.toContain('#');
  });

  it('forgets the trip, then POSTs the code with the verifier to the auth origin without credentials', async () => {
    const p = page(`${PAGE}/cb#state=st-1&code=c-1`, kept());
    const token = await completeAppToken(p.env, p.session);
    expect(token).toEqual({
      accessToken: 'tok-1',
      tokenType: 'Bearer',
      expiresIn: 900,
      expiresAt: 1_000_000 + 900_000,
      service: 'dave/notes',
    });
    expect(p.posts.length).toBe(1);
    const [post] = p.posts;
    expect(post.url).toBe(`${AUTH}/sso/token`);
    expect(post.init.method).toBe('POST');
    expect(post.init.credentials).toBe('omit');
    expect((post.init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(JSON.parse(String(post.init.body))).toEqual({
      grant_type: 'authorization_code',
      code: 'c-1',
      verifier: TRIP.verifier,
    });
    expect(p.log.indexOf(`remove ${TOKEN_KEY}`)).toBeLessThan(p.log.findIndex((l) => l.startsWith('fetch ')));
    expect(p.store.has(TOKEN_KEY)).toBe(false);
  });

  it('a state this page did not keep sends nothing, and leaves the trip in flight alone', async () => {
    const p = page(`${PAGE}/cb#state=someone-elses&code=c-1`, kept());
    expect((await rejection(completeAppToken(p.env, p.session))).code).toBe('sign_in_aborted');
    expect(p.posts).toEqual([]);
    expect(p.store.has(TOKEN_KEY)).toBe(true);
    expect(p.log.some((l) => l.startsWith('replaceState '))).toBe(true);

    const none = page(`${PAGE}/cb#state=st-1&code=c-1`);
    expect((await rejection(completeAppToken(none.env, none.session))).code).toBe('sign_in_aborted');
    expect(none.posts).toEqual([]);
  });

  it('a denial sends nothing and says so', async () => {
    const p = page(`${PAGE}/cb#state=st-1&error=consent_denied`, kept());
    expect((await rejection(completeAppToken(p.env, p.session))).code).toBe('consent_denied');
    expect(p.posts).toEqual([]);
    expect(p.store.has(TOKEN_KEY)).toBe(false);
  });

  it('with no trip in the URL, does nothing at all', async () => {
    const p = page(`${PAGE}/cb?x=1`, kept());
    expect(await completeAppToken(p.env, p.session)).toBeNull();
    expect(p.log).toEqual([]);
    const other = page(`${PAGE}/cb#section-2`, kept());
    expect(await completeAppToken(other.env, other.session)).toBeNull();
    expect(other.log).toEqual([]);
  });

  it('a refused code or an unsendable request is an error, never a token', async () => {
    const refused = page(`${PAGE}/cb#state=st-1&code=c-1`, kept(), () => new Response('unauthorized', { status: 401 }));
    expect((await rejection(completeAppToken(refused.env, refused.session))).code).toBe('sign_in_aborted');
    const offline = page(`${PAGE}/cb#state=st-1&code=c-1`, kept(), () => new TypeError('network'));
    expect((await rejection(completeAppToken(offline.env, offline.session))).code).toBe('network');
    const odd = page(`${PAGE}/cb#state=st-1&code=c-1`, kept(), () => new Response('{"token_type":"Bearer"}', { status: 200 }));
    expect((await rejection(completeAppToken(odd.env, odd.session))).code).toBe('sign_in_aborted');
    for (const p of [refused, offline, odd]) expect(p.held.size).toBe(0);
  });

  it('completeAppToken persists the session it redeems, sending grant_type authorization_code', async () => {
    const p = page(`${PAGE}/cb#state=st-1&code=c-1`, kept());
    const token = await completeAppToken(p.env, p.session);
    expect(JSON.parse(String(p.posts[0].init.body))).toMatchObject({ grant_type: 'authorization_code' });
    // The page gets the access token; the refresh token stays with the session.
    expect(token).not.toHaveProperty('refreshToken');
    expect(JSON.stringify(token)).not.toContain(REFRESH);
    expect([...p.held.keys()]).toEqual([`${SESSION_KEY_PREFIX}dave/notes`]);
    expect(JSON.parse(p.held.get(`${SESSION_KEY_PREFIX}dave/notes`)!)).toEqual({
      authOrigin: AUTH,
      accessToken: 'tok-1',
      accessExpiresAt: 1_000_000 + 900_000,
      refreshToken: REFRESH,
      refreshExpiresAt: 1_000_000 + 2_592_000_000,
    });
    // The session hands that token out, with no request.
    const session = appTokenSession('dave/notes', {}, p.session);
    expect(session.signedIn()).toBe(true);
    expect(await session.accessToken()).toBe('tok-1');
    expect(p.posts.length).toBe(1);
  });

  it('a redeem answered without a refresh token is not a sign-in, and keeps nothing', async () => {
    for (const body of [
      { access_token: 'tok-1', token_type: 'Bearer', expires_in: 900 },
      { access_token: 'tok-1', token_type: 'Bearer', expires_in: 900, refresh_token: '', refresh_expires_in: 1 },
      { access_token: 'tok-1', token_type: 'Bearer', expires_in: 900, refresh_token: REFRESH },
    ]) {
      const p = page(`${PAGE}/cb#state=st-1&code=c-1`, kept(), () => new Response(JSON.stringify(body), { status: 200 }));
      expect((await rejection(completeAppToken(p.env, p.session))).code).toBe('sign_in_aborted');
      expect(p.held.size).toBe(0);
    }
  });

  it('parses the landing fragment', () => {
    expect(parseTokenLanding('#state=s&code=c')).toEqual({ state: 's', code: 'c', error: null });
    expect(parseTokenLanding('#state=s&error=consent_denied')).toEqual({ state: 's', code: null, error: 'consent_denied' });
    expect(parseTokenLanding('#code=c')).toBeNull();
    expect(parseTokenLanding('')).toBeNull();
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
});
