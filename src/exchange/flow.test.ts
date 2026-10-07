import { describe, it, expect, beforeEach } from 'vitest';
import {
  EXCHANGE_DATA_ID,
  EXCHANGE_KEY,
  MAX_SIGN_IN_PANES,
  exchangeSignInUrl,
  parseLanding,
  readExchangeData,
  returnLocation,
  runExchangePage,
  startExchangeSignIn,
  type ExchangeEnv,
} from './flow';
import { s256Challenge } from '../internal/pkce';

/** The template a pane's label goes into, as the exchange page carries it. */
const LABEL_TEMPLATE = 'https://{label}.boogy.app';
/** What the exchange page carries: where `/authorize` is, and that template. */
const DATA = {
  authOrigin: 'https://auth.boogy.app',
  // owner-subdomain-ok: the page's wire field; it addresses a pane's label
  appOriginTemplate: LABEL_TEMPLATE,
};

/** Everything the exchange page touches, recorded in one ordered log so a test
 *  can read what happened before what. */
function page(href: string, kept: Record<string, string> = {}, answer: (url: string) => number = () => 204) {
  const log: string[] = [];
  const store = new Map(Object.entries(kept));
  const posts: { url: string; init: RequestInit }[] = [];
  const url = new URL(href);
  let current = url.href;
  const env: ExchangeEnv = {
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
      replace: (u: string | URL) => void log.push(`replace ${String(u)}`),
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
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => {
        log.push(`remove ${k}`);
        store.delete(k);
      },
    },
    fetch: (async (input: string | URL, init: RequestInit) => {
      const u = String(input);
      log.push(`fetch ${u} (address bar: ${current})`);
      posts.push({ url: u, init });
      const status = answer(u);
      if (status === 0) throw new TypeError('network');
      return new Response(null, { status });
    }) as unknown as typeof fetch,
    document,
  };
  return { env, log, posts, store };
}

function putData(data: unknown = DATA): void {
  document.head.innerHTML = '';
  document.body.innerHTML = '<p>Signing in…</p>';
  const el = document.createElement('script');
  el.type = 'application/json';
  el.id = EXCHANGE_DATA_ID;
  el.textContent = JSON.stringify(data);
  document.head.append(el);
}

const TRIP = { state: 'st-1', verifier: 'v'.repeat(43) };
const kept = () => ({ [EXCHANGE_KEY]: JSON.stringify(TRIP) });
const landingHref = (fragment: string) => `https://boards.boogy.app/boogy/exchange#${fragment}`;

beforeEach(() => putData());

describe('the exchange page, finishing a trip', () => {
  it('drops the fragment before its first request, and checks state before any POST', async () => {
    const p = page(landingHref('state=st-1&return_to=%2Fchats%2F&code=aaaa-k3v9.c1&code=bbbb-k3v9.c2'), kept());
    await runExchangePage(p.env);
    const firstFetch = p.log.findIndex((l) => l.startsWith('fetch '));
    const cleared = p.log.findIndex((l) => l.startsWith('replaceState '));
    const stateRead = p.log.findIndex((l) => l === `read ${EXCHANGE_KEY}`);
    expect(cleared).toBeGreaterThanOrEqual(0);
    expect(stateRead).toBeGreaterThan(cleared);
    expect(firstFetch).toBeGreaterThan(stateRead);
    expect(p.log[cleared]).toBe('replaceState /boogy/exchange');
    for (const l of p.log.filter((l) => l.startsWith('fetch '))) expect(l).not.toContain('#');
  });

  it('POSTs each code, with the verifier, to its own app origin, then forgets the trip and goes back', async () => {
    const p = page(landingHref('state=st-1&return_to=%2Fchats%2F&code=aaaa-k3v9.c1&code=bbbb-k3v9.c2'), kept());
    await runExchangePage(p.env);
    expect(p.posts.map((x) => x.url)).toEqual([
      'https://aaaa-k3v9.boogy.app/boogy/exchange',
      'https://bbbb-k3v9.boogy.app/boogy/exchange',
    ]);
    for (const [i, x] of p.posts.entries()) {
      expect(x.init.method).toBe('POST');
      expect(x.init.credentials).toBe('include');
      expect((x.init.headers as Record<string, string>)['content-type']).toBe('application/json');
      expect(JSON.parse(String(x.init.body))).toEqual({ code: `c${i + 1}`, verifier: TRIP.verifier });
    }
    const removed = p.log.indexOf(`remove ${EXCHANGE_KEY}`);
    const back = p.log.findIndex((l) => l.startsWith('replace '));
    const lastFetch = p.log.reduce((at, l, i) => (l.startsWith('fetch ') ? i : at), -1);
    expect(removed).toBeGreaterThan(lastFetch);
    expect(back).toBeGreaterThan(removed);
    expect(p.log[back]).toBe('replace https://boards.boogy.app/chats/');
    expect(p.store.has(EXCHANGE_KEY)).toBe(false);
  });

  it('a state mismatch makes no POST and goes nowhere', async () => {
    const stores: Record<string, string>[] = [{ [EXCHANGE_KEY]: JSON.stringify({ ...TRIP, state: 'other' }) }, {}];
    for (const store of stores) {
      const p = page(landingHref('state=st-1&return_to=https%3A%2F%2Fevil.example%2F&code=aaaa-k3v9.c1'), store);
      await runExchangePage(p.env);
      expect(p.posts).toEqual([]);
      expect(p.log.some((l) => l.startsWith('replace ') || l.startsWith('assign '))).toBe(false);
      expect(p.log[0]).toMatch(/^replaceState /);
      expect(document.body.textContent).toContain('could not be completed');
    }
  });

  it('a failed code does not stop the others, and the person comes back marked partial', async () => {
    // A refusal (401), then — separately — a request that never got an answer.
    for (const failing of [401, 0]) {
      const p = page(
        landingHref('state=st-1&return_to=%2Fchats%2F%23here&code=aaaa-k3v9.c1&code=bbbb-k3v9.c2&code=cccc-k3v9.c3'),
        kept(),
        (u) => (u.startsWith('https://bbbb-k3v9.') ? failing : 204),
      );
      await runExchangePage(p.env);
      expect(p.posts, `failing=${failing}`).toHaveLength(3);
      expect(p.log.at(-1), `failing=${failing}`).toBe('replace https://boards.boogy.app/chats/#signin=partial');
    }
    // And when every code redeems, there is no marker.
    const ok = page(landingHref('state=st-1&return_to=%2Fchats%2F&code=aaaa-k3v9.c1'), kept());
    await runExchangePage(ok.env);
    expect(ok.log.at(-1)).toBe('replace https://boards.boogy.app/chats/');
  });

  it('redeems every pane at once, not one after another', async () => {
    const p = page(landingHref('state=st-1&return_to=%2F&code=aaaa-k3v9.c1&code=bbbb-k3v9.c2&code=cccc-k3v9.c3'), kept());
    let inFlight = 0;
    let most = 0;
    p.env.fetch = (async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, 0));
      inFlight -= 1;
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    await runExchangePage(p.env);
    expect(most).toBe(3);
    expect(p.log.at(-1)).toBe('replace https://boards.boogy.app/');
  });

  it('a label that is not a service label is never turned into an address', async () => {
    // `@`, `/` and `:` would each make the template name a different host.
    const p = page(landingHref('state=st-1&return_to=%2F&code=ev%40il.c1&code=x%2Fy.c3&code=h%3A1.c4&code=aaaa-k3v9.c2'), kept());
    await runExchangePage(p.env);
    expect(p.posts.map((x) => x.url)).toEqual(['https://aaaa-k3v9.boogy.app/boogy/exchange']);
    expect(p.log.at(-1)).toBe('replace https://boards.boogy.app/#signin=partial');
  });

  it('a cancelled consent makes no POST and comes back marked cancelled', async () => {
    const p = page(landingHref('state=st-1&return_to=%2Fchats%2F&error=consent_denied'), kept());
    await runExchangePage(p.env);
    expect(p.posts).toEqual([]);
    expect(p.log.at(-1)).toBe('replace https://boards.boogy.app/chats/#signin=cancelled');
  });
});

describe('the exchange page, starting a trip for a page on another origin', () => {
  it('keeps the verifier here and leaves for /authorize with no history entry behind it', async () => {
    const p = page('https://boards.boogy.app/boogy/exchange?pane=aaaa-k3v9&pane=bbbb-k3v9&return_to=https%3A%2F%2Fboards.boogy.app%2Fb%2F1');
    await runExchangePage(p.env);
    expect(p.posts).toEqual([]);
    const go = p.log.find((l) => l.startsWith('replace '))!;
    const u = new URL(go.slice('replace '.length));
    expect(u.origin + u.pathname).toBe('https://auth.boogy.app/authorize');
    expect(u.searchParams.has('owner')).toBe(false);
    expect(u.searchParams.getAll('pane')).toEqual(['aaaa-k3v9', 'bbbb-k3v9']);
    expect(u.searchParams.get('return_to')).toBe('https://boards.boogy.app/b/1');
    const trip = JSON.parse(p.store.get(EXCHANGE_KEY)!);
    expect(u.searchParams.get('state')).toBe(trip.state);
    expect(u.searchParams.get('code_challenge')).toBe(await s256Challenge(trip.verifier));
    expect(go).not.toContain(trip.verifier);
  });
});

/** `n` distinct well-formed labels. */
const labels = (n: number) => Array.from({ length: n }, (_, i) => `l${String(i).padStart(9, '0')}-pane`);

describe('the cap on one trip', () => {
  // The platform signs in at most this many panes in one trip and refuses the
  // whole trip past it; a page asking for more must split them itself, so a
  // trip that would be refused is never started.
  it('is the platform\'s 32 panes', () => {
    expect(MAX_SIGN_IN_PANES).toBe(32);
  });

  it('a trip naming the cap goes, and one more than the cap starts nothing, from either side', async () => {
    const here = page('https://boards.boogy.app/');
    expect(await startExchangeSignIn({ ...DATA, labels: labels(MAX_SIGN_IN_PANES), returnTo: '/' }, here.env)).toBe(true);
    const from = page('https://boards.boogy.app/b/1');
    const site = { site: 'https://boards.boogy.app', returnTo: 'https://boards.boogy.app/b/1' };
    expect(await startExchangeSignIn({ ...site, labels: labels(MAX_SIGN_IN_PANES) }, from.env)).toBe(true);
    for (const opts of [
      { ...DATA, labels: labels(MAX_SIGN_IN_PANES + 1), returnTo: '/' },
      { ...site, labels: labels(MAX_SIGN_IN_PANES + 1) },
    ]) {
      const p = page('https://boards.boogy.app/');
      expect(await startExchangeSignIn(opts, p.env)).toBe(false);
      expect(p.log.filter((l) => l.startsWith('assign ') || l.startsWith('replace '))).toEqual([]);
      expect(p.store.has(EXCHANGE_KEY)).toBe(false);
    }
  });

  it('the exchange page starts no trip a page on another origin asked for past the cap', async () => {
    const q = labels(MAX_SIGN_IN_PANES + 1).map((l) => `pane=${l}`).join('&');
    const p = page(`https://boards.boogy.app/boogy/exchange?${q}&return_to=https%3A%2F%2Fboards.boogy.app%2Fb%2F1`);
    await runExchangePage(p.env);
    expect(p.log.filter((l) => l.startsWith('assign ') || l.startsWith('replace '))).toEqual([]);
    expect(p.store.has(EXCHANGE_KEY)).toBe(false);
  });
});

describe('startExchangeSignIn', () => {
  it('on the boards origin, keeps the trip here and goes to /authorize', async () => {
    const p = page('https://boards.boogy.app/chats/');
    expect(await startExchangeSignIn({ ...DATA, labels: ['aaaa-k3v9'], returnTo: '/chats/' }, p.env)).toBe(true);
    const u = new URL(p.log.find((l) => l.startsWith('assign '))!.slice('assign '.length));
    expect(u.pathname).toBe('/authorize');
    expect(u.searchParams.get('mode')).toBe('exchange');
    expect(JSON.parse(p.store.get(EXCHANGE_KEY)!).state).toBe(u.searchParams.get('state'));
  });

  // Each pane's label names its own owner, and a board may hold panes of
  // several: a trip names no owner, and offers no way to name one.
  it('takes no owner', async () => {
    const p = page('https://boards.boogy.app/b/1');
    const went = await startExchangeSignIn(
      // @ts-expect-error — a trip names no owner
      { ...DATA, owner: 'dave', labels: ['notes-k3v9'], returnTo: '/b/1' },
      p.env,
    );
    expect(went).toBe(true);
    const u = new URL(p.log.find((l) => l.startsWith('assign '))!.slice('assign '.length));
    expect(u.searchParams.has('owner')).toBe(false);
  });

  // A board is on the boards origin, where the trip comes back to: it starts
  // there, at the platform's exchange page, which keeps the verifier on the
  // origin it lands on.
  it('a board\'s trip starts on the boards origin\'s exchange page, for panes of any owner', async () => {
    const p = page('https://boards.boogy.app/b/1');
    const went = await startExchangeSignIn(
      { site: 'https://boards.boogy.app', labels: ['notes-k3v9', 'chat-x7q2a'], returnTo: 'https://boards.boogy.app/b/1' },
      p.env,
    );
    expect(went).toBe(true);
    const u = new URL(p.log[0].slice('assign '.length));
    expect(u.origin + u.pathname).toBe('https://boards.boogy.app/boogy/exchange');
    expect(u.searchParams.getAll('pane')).toEqual(['notes-k3v9', 'chat-x7q2a']);
    expect(u.searchParams.get('return_to')).toBe('https://boards.boogy.app/b/1');
  });

  it('from another origin, goes to the boards origin to start there', async () => {
    const p = page('https://console.example.test/b/1');
    const went = await startExchangeSignIn(
      { site: 'https://boards.boogy.app/chats', labels: ['aaaa-k3v9'], returnTo: 'https://boards.boogy.app/b/1' },
      p.env,
    );
    expect(went).toBe(true);
    expect(p.log).toEqual([
      `assign ${exchangeSignInUrl({ site: 'https://boards.boogy.app', labels: ['aaaa-k3v9'], returnTo: 'https://boards.boogy.app/b/1' })}`,
    ]);
    expect(p.store.has(EXCHANGE_KEY)).toBe(false);
  });

  it('starts nothing with no panes, a malformed label, or no auth origin', async () => {
    for (const opts of [
      { ...DATA, labels: [], returnTo: '/' },
      { ...DATA, labels: ['evil.example'], returnTo: '/' },
      { ...DATA, authOrigin: '', labels: ['aaaa-k3v9'], returnTo: '/' },
    ]) {
      const p = page('https://boards.boogy.app/');
      expect(await startExchangeSignIn(opts, p.env)).toBe(false);
      expect(p.log.filter((l) => l.startsWith('assign ') || l.startsWith('replace '))).toEqual([]);
    }
  });
});

describe('the pieces', () => {
  it('reads the page data and refuses a malformed block', () => {
    expect(readExchangeData(document)).toEqual({ authOrigin: DATA.authOrigin, labelOriginTemplate: LABEL_TEMPLATE });
    for (const bad of [
      { ...DATA, appOriginTemplate: 7 }, // owner-subdomain-ok: the page's wire field
      { ...DATA, appOriginTemplate: 'https://boogy.app' }, // owner-subdomain-ok: the page's wire field
      // The placeholder's old spelling is not this one: a template carrying
      // it would compose a host out of a literal, so it is refused.
      { ...DATA, appOriginTemplate: 'https://{owner}.boogy.app' }, // owner-subdomain-ok: the retired spelling, refused
      { ...DATA, authOrigin: 'javascript:x' },
    ]) {
      putData(bad);
      expect(readExchangeData(document)).toBeNull();
    }
  });

  it('parses a landing and refuses one with no state', () => {
    expect(parseLanding('#state=s&return_to=%2F&code=aaaa-k3v9.x.y')).toEqual({
      state: 's',
      returnTo: '/',
      codes: [{ label: 'aaaa-k3v9', code: 'x.y' }],
      error: null,
    });
    expect(parseLanding('#return_to=%2F&code=aaaa-k3v9.x')).toBeNull();
    expect(parseLanding('')).toBeNull();
  });

  it('only ever goes back to an http(s) place', () => {
    expect(returnLocation('javascript:alert(1)', 'https://boards.boogy.app/boogy/exchange', null)).toBe('https://boards.boogy.app/');
    expect(returnLocation('/x?y=1', 'https://boards.boogy.app/boogy/exchange', 'partial')).toBe('https://boards.boogy.app/x?y=1#signin=partial');
  });
});

describe('a board signs in service labels, of any owner, from the boards origin', () => {
  // What the boards origin's exchange page carries: no owner, since a board's
  // panes may belong to several.
  // owner-subdomain-ok: the template addresses a pane's own label, not an owner
  const BOARDS = { authOrigin: 'https://auth.boogy.app', appOriginTemplate: 'https://{label}.boogy.app' };

  it('reads a page block that names no owner', () => {
    putData(BOARDS);
    expect(readExchangeData(document)).toEqual({ authOrigin: BOARDS.authOrigin, labelOriginTemplate: LABEL_TEMPLATE });
  });

  it('starts a trip for panes of two owners, naming no owner', async () => {
    putData(BOARDS);
    const p = page('https://boards.boogy.app/boogy/exchange?pane=notes-k3v9&pane=chat-x7q2a&return_to=%2Fb%2F1');
    await runExchangePage(p.env);
    const go = p.log.find((l) => l.startsWith('replace '))!;
    const u = new URL(go.slice('replace '.length));
    expect(u.origin + u.pathname).toBe('https://auth.boogy.app/authorize');
    expect(u.searchParams.has('owner')).toBe(false);
    expect(u.searchParams.getAll('pane')).toEqual(['notes-k3v9', 'chat-x7q2a']);
    expect(u.searchParams.get('return_to')).toBe('/b/1');
  });

  it('POSTs only to service labels: a bare word is a platform name, never a pane', async () => {
    putData(BOARDS);
    const p = page(
      `https://boards.boogy.app/boogy/exchange#state=st-1&return_to=%2Fb%2F1&code=notes-k3v9.c1&code=aaaaaaaaaa.c2&code=a--b-k3v9.c3&code=boards.c4&code=notes-k3.c5`,
      kept(),
    );
    await runExchangePage(p.env);
    expect(p.posts.map((x) => x.url)).toEqual(['https://notes-k3v9.boogy.app/boogy/exchange']);
    expect(p.log.at(-1)).toBe('replace https://boards.boogy.app/b/1#signin=partial');
  });

  it('a trip naming a bare word starts nothing', async () => {
    const p = page('https://boards.boogy.app/b/1');
    expect(await startExchangeSignIn({ ...BOARDS, labels: ['aaaaaaaaaa'], returnTo: '/' } as never, p.env)).toBe(false);
    expect(await startExchangeSignIn({ ...BOARDS, labels: ['notes-k3v9'], returnTo: '/' } as never, p.env)).toBe(true);
  });
});
