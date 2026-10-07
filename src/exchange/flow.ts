// Sign-in for a board's panes, each an app on an origin of its own, without
// the page ever being sent to one of those origins.
//
// An app's own origin runs the app's code, and that code can register a
// service worker there, which answers every navigation to that origin — so a
// board's sign-in that passed through each pane's origin could be shown any
// page one of them liked. The trip therefore starts and ends on the boards
// origin, at the platform's exchange page there, and each app's origin only
// receives a background `fetch` that sets its cookies:
//
//   1. a page on the boards origin keeps a PKCE verifier and a `state` in its
//      own sessionStorage and goes to `/authorize?mode=exchange&…`;
//   2. the platform sends the browser back to the boards origin's
//      `/boogy/exchange` page with one code per app in the URL's FRAGMENT,
//      which no server ever sees;
//   3. that page checks `state`, then POSTs each code with the verifier to its
//      app's own origin, which sets that origin's cookies;
//   4. the page returns the person to where they started.
import { randomState, randomVerifier, s256Challenge } from '../internal/pkce';
// A pane's label is checked for a service label's shape before it goes into
// the origin template: anything else could compose a different host out of
// it, so it is refused, never used.
import { isServiceLabel } from '../internal/service-label';

/** Where a trip in flight keeps `{ state, verifier }`: this origin's
 *  sessionStorage, read back by the exchange page on the same origin. */
export const EXCHANGE_KEY = 'boogy.exchange.v1';
/** The boards origin's exchange page. */
export const EXCHANGE_PATH = '/boogy/exchange';
/** The id of the exchange page's data block. */
export const EXCHANGE_DATA_ID = 'boogy-exchange-data';

/** Where a pane's label goes in the exchange page's origin template. The
 *  platform's spelling, which both ends substitute: a template that does not
 *  carry it exactly once is refused, never composed. */
const LABEL_PLACEHOLDER = '{label}';

/** The most panes one sign-in trip may name. The platform refuses a trip that
 *  names more — the whole trip, not the excess — so a page with more panes to
 *  sign in names this many now and the rest on a later trip; a trip asked for
 *  past it is never started. */
export const MAX_SIGN_IN_PANES = 32;


/** The panes a trip signs in, and where the person lands afterwards. */
interface Trip {
  /** Each pane's own-origin label (`notes-k3v9` in `https://notes-k3v9.boogy.app`). */
  labels: readonly string[];
  /** A path on the boards origin, or that origin itself. */
  returnTo: string;
}

/** A trip started on the boards origin, which keeps its verifier. It names no
 *  owner: each pane's label names its own, and a board may hold panes of
 *  several. */
export interface ExchangeSignInHere extends Trip {
  /** Where `/authorize` is served, e.g. `https://auth.boogy.ai`. */
  authOrigin: string;
}

/** A trip started at `site`, the boards origin, on the platform's exchange
 *  page there — which keeps the verifier on the origin the trip comes back to
 *  (sessionStorage is per origin). A board passes its own origin; a page on
 *  another origin passes the boards origin. */
export interface ExchangeSignInFrom extends Trip {
  site: string;
}

/** What a sign-in trip needs, from wherever it starts. */
export type ExchangeSignIn = ExchangeSignInHere | ExchangeSignInFrom;

/** The browser surfaces a trip touches — injectable, so it can be tested. */
export interface ExchangeEnv {
  location: Pick<Location, 'origin' | 'href' | 'pathname' | 'search' | 'hash' | 'assign' | 'replace'>;
  history: Pick<History, 'replaceState' | 'state'>;
  /** `null` when the browser refuses storage — no trip can start or finish then. */
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  fetch: typeof fetch;
  document: Document;
}

/** The page's own window as an [`ExchangeEnv`]. */
export function windowEnv(win: Window = window): ExchangeEnv {
  let storage: ExchangeEnv['storage'];
  try {
    storage = win.sessionStorage;
  } catch {
    storage = null;
  }
  return {
    location: win.location,
    history: win.history,
    storage,
    fetch: win.fetch.bind(win),
    document: win.document,
  };
}

/** The exchange page on `site` that starts a trip for `labels` and comes back
 *  to `returnTo` — where a page on another origin sends the browser. */
export function exchangeSignInUrl(p: { site: string; labels: readonly string[]; returnTo: string }): string {
  const url = new URL(EXCHANGE_PATH, new URL(p.site).origin);
  for (const label of p.labels) url.searchParams.append('pane', label);
  url.searchParams.set('return_to', p.returnTo);
  return url.toString();
}

/** `<auth>/authorize?mode=exchange&pane…&code_challenge&state&return_to`.
 *  No owner: each pane's label names its own. The verifier is never in it:
 *  only its S256 challenge is. */
export function exchangeAuthorizeUrl(p: {
  authOrigin: string;
  labels: readonly string[];
  returnTo: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(`${p.authOrigin.replace(/\/+$/, '')}/authorize`);
  url.searchParams.set('mode', 'exchange');
  for (const label of p.labels) url.searchParams.append('pane', label);
  url.searchParams.set('code_challenge', p.challenge);
  url.searchParams.set('state', p.state);
  url.searchParams.set('return_to', p.returnTo);
  return url.toString();
}

/** Whether `labels` is a trip's worth of panes: one to `MAX_SIGN_IN_PANES`,
 *  each a well-formed label. */
function namesPanes(labels: readonly string[]): boolean {
  return labels.length > 0 && labels.length <= MAX_SIGN_IN_PANES && labels.every(isServiceLabel);
}

/** Keep a fresh verifier and state on THIS origin, then leave for `/authorize`
 *  by `go`. Resolves whether the trip went. */
async function beginTrip(opts: ExchangeSignInHere, env: ExchangeEnv, go: (url: string) => void): Promise<boolean> {
  if (!env.storage || !/^https?:\/\//.test(opts.authOrigin)) return false;
  if (!namesPanes(opts.labels)) return false;
  const verifier = randomVerifier();
  const state = randomState();
  try {
    env.storage.setItem(EXCHANGE_KEY, JSON.stringify({ state, verifier }));
  } catch {
    return false;
  }
  const challenge = await s256Challenge(verifier);
  go(exchangeAuthorizeUrl({ authOrigin: opts.authOrigin, labels: opts.labels, returnTo: opts.returnTo, state, challenge }));
  return true;
}

/**
 * Sign in the app panes named by `labels` (at most `MAX_SIGN_IN_PANES`, of
 * any owner), in one trip, and come back to `returnTo`. Resolves whether the
 * page is leaving.
 *
 * With `authOrigin`, on the boards origin, it keeps the verifier here and goes
 * to `/authorize`. With `site`, the boards origin, it goes to that origin's
 * exchange page, which starts the same trip there. Either way the trip starts
 * and ends on the boards origin, and never on a pane's.
 */
export async function startExchangeSignIn(opts: ExchangeSignIn, env: ExchangeEnv = windowEnv()): Promise<boolean> {
  if (!namesPanes(opts.labels)) return false;
  if ('site' in opts) {
    let site: string;
    try {
      site = new URL(opts.site).origin;
    } catch {
      return false;
    }
    env.location.assign(exchangeSignInUrl({ site, labels: opts.labels, returnTo: opts.returnTo }));
    return true;
  }
  return beginTrip(opts, env, (url) => env.location.assign(url));
}

/** What the platform renders into the exchange page. */
export interface ExchangeData {
  authOrigin: string;
  /** How a pane's own origin is addressed on this edge: an absolute origin
   *  with one placeholder where the pane's label goes. */
  labelOriginTemplate: string;
}

export function readExchangeData(doc: Document): ExchangeData | null {
  const raw = doc.getElementById(EXCHANGE_DATA_ID)?.textContent;
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const d = v as Record<string, unknown>;
  const template = d.appOriginTemplate; // owner-subdomain-ok: the page's wire field; it addresses a pane's label
  if (typeof d.authOrigin !== 'string' || typeof template !== 'string') return null;
  if (!/^https?:\/\//.test(d.authOrigin) || !/^https?:\/\//.test(template)) return null;
  if (template.split(LABEL_PLACEHOLDER).length !== 2) return null;
  return { authOrigin: d.authOrigin, labelOriginTemplate: template };
}

/** The fragment the platform sends the exchange page back with. */
export interface Landing {
  state: string;
  returnTo: string;
  /** `code=<label>.<code>`, in order. */
  codes: { label: string; code: string }[];
  /** `consent_denied` when the person cancelled; then there are no codes. */
  error: string | null;
}

/** Parse `#state=…&return_to=…&code=<label>.<code>…`, or `null` when the
 *  fragment carries no trip. */
export function parseLanding(hash: string): Landing | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const state = params.get('state');
  const returnTo = params.get('return_to');
  if (!state || !returnTo) return null;
  const codes: Landing['codes'] = [];
  for (const raw of params.getAll('code')) {
    const dot = raw.indexOf('.');
    if (dot <= 0) continue;
    codes.push({ label: raw.slice(0, dot), code: raw.slice(dot + 1) });
  }
  return { state, returnTo, codes, error: params.get('error') };
}

/** Where to send the person back, with `marker` as `#signin=<marker>` when the
 *  trip did not sign everything in. Only an http(s) place is ever navigated to. */
export function returnLocation(returnTo: string, base: string, marker: 'partial' | 'cancelled' | null): string {
  let u: URL;
  try {
    u = new URL(returnTo, base);
  } catch {
    u = new URL('/', base);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') u = new URL('/', base);
  if (marker) u.hash = `signin=${marker}`;
  return u.toString();
}

function readTrip(storage: ExchangeEnv['storage']): { state: string; verifier: string } | null {
  try {
    const v: unknown = JSON.parse(storage?.getItem(EXCHANGE_KEY) ?? 'null');
    if (typeof v !== 'object' || v === null) return null;
    const { state, verifier } = v as Record<string, unknown>;
    return typeof state === 'string' && typeof verifier === 'string' && state && verifier ? { state, verifier } : null;
  } catch {
    return null;
  }
}

function say(env: ExchangeEnv, text: string): void {
  const p = env.document.createElement('p');
  p.textContent = text;
  env.document.body.replaceChildren(p);
}

/**
 * The exchange page. With a trip's fragment, it finishes the trip, in this
 * order: read the fragment; drop it from the address bar and history; check
 * its `state` against the one this origin kept; redeem every code on its own
 * app origin, in parallel; forget the trip; go back. With `?pane=…&return_to=…` instead, it
 * is where a page on another origin (a board) starts a trip, here.
 */
export async function runExchangePage(env: ExchangeEnv = windowEnv()): Promise<void> {
  const data = readExchangeData(env.document);
  if (!data) {
    say(env, 'Sign-in is not available here.');
    return;
  }
  // 1. Read the fragment.
  const landing = parseLanding(env.location.hash);
  if (landing) {
    // 2. Drop it before anything else, so no code outlives this page in the
    //    address bar or in history.
    env.history.replaceState(env.history.state, '', `${env.location.pathname}${env.location.search}`);
    // 3. Only the trip this origin started may finish here.
    const trip = readTrip(env.storage);
    if (!trip || trip.state !== landing.state) {
      say(env, 'This sign-in could not be completed. Close this page and try again.');
      return;
    }
    // 4. Redeem every code on its own app origin, all at once — they are
    //    independent requests to different origins — and one failure does not
    //    stop the rest.
    let failed = landing.error !== null;
    if (landing.error === null) {
      const redeemed = await Promise.all(
        landing.codes.map(async ({ label, code }) => {
          if (!isServiceLabel(label)) return false;
          const origin = data.labelOriginTemplate.replace(LABEL_PLACEHOLDER, label);
          try {
            const res = await env.fetch(`${origin}${EXCHANGE_PATH}`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ code, verifier: trip.verifier }),
            });
            return res.status === 204;
          } catch {
            return false;
          }
        }),
      );
      if (redeemed.some((ok) => !ok)) failed = true;
    }
    // 5. Forget the trip.
    try {
      env.storage?.removeItem(EXCHANGE_KEY);
    } catch {
      /* it expires with the tab */
    }
    // 6. Back to where the person was.
    const marker = landing.error === 'consent_denied' ? 'cancelled' : failed ? 'partial' : null;
    env.location.replace(returnLocation(landing.returnTo, env.location.href, marker));
    return;
  }
  // A board's start: this origin keeps the verifier, and this page leaves no
  // history entry behind it.
  const params = new URLSearchParams(env.location.search);
  const labels = params.getAll('pane');
  const returnTo = params.get('return_to');
  if (labels.length > 0 && returnTo) {
    const went = await beginTrip(
      { authOrigin: data.authOrigin, labels, returnTo },
      env,
      (url) => env.location.replace(url),
    );
    if (went) return;
  }
  say(env, 'There is nothing to sign in here.');
}
