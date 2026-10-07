// App tokens: signing a person in to a service from a website on another
// origin.
//
// A service's own pages sign its people in on its own address and keep their
// session in a cookie there. A page on another origin — a website the
// service's `[ingress.cors] allowed_origins` names — cannot use that cookie, so
// it signs them in here and calls the service with
// `Authorization: Bearer <app token>`. Any service may admit such websites,
// with a frontend of its own or without; the websites it lists are its
// opt-in. Authorization code with PKCE, for a public client:
//
//   1. `requestAppToken` keeps a PKCE verifier and a `state` in this origin's
//      sessionStorage and sends the person to `/authorize?mode=token&…`;
//   2. the platform sends them back to `redirect` — exactly one of the return
//      URLs the service registers — with the code in the URL's FRAGMENT, which
//      no server ever sees;
//   3. `completeAppToken`, on that page, drops the fragment, checks `state`,
//      then POSTs the code with the verifier to `<auth>/sso/token` and returns
//      the app token.
//
// The redeem also grants a refresh token. `completeAppToken` keeps the pair as
// the person's session for the service, and `appTokenSession(service)` renews
// the access token from it, so the person signs in again only when the
// platform says they must. The page is handed the access token alone. It is
// encrypted: an opaque string that says nothing about the person to this page.
import { BoogyError } from '../errors';
import { parseApp } from '../internal/urls';
import { platformConfig } from '../internal/platform-config';
import { randomState, randomVerifier, s256Challenge } from '../internal/pkce';
import {
  TOKEN_PATH,
  isTrustedOrigin,
  requestDeadline,
  sessionFromGrant,
  storeSession,
  windowSessionEnv,
  type SessionEnv,
} from './session';

export { TOKEN_PATH };

/** Where a trip in flight keeps `{ state, verifier, authOrigin, service }`:
 *  this origin's sessionStorage, read back by the page the trip returns to. */
export const TOKEN_KEY = 'boogy.app-token.v1';

/** What `requestAppToken` needs. */
export interface AppTokenRequest {
  /** The service, as `owner/service`. */
  service: string;
  /** Where the person comes back to: EXACTLY one of the return URLs the
   *  service registers (`[ingress.app_tokens] redirect_uris` in its manifest),
   *  on THIS page's origin, as an absolute URL. It is sent as written: the
   *  platform compares it byte for byte and refuses any other URL, so no other
   *  page on this origin can receive the code. It must not carry a fragment —
   *  the code comes back in one. */
  redirect: string;
  /** Where `/authorize` is served, e.g. `https://auth.boogy.ai`. Defaults to
   *  the platform config this page loaded; required on a page the platform
   *  does not serve. */
  authOrigin?: string;
}

/** An app token for one service. */
export interface AppToken {
  /** Send as `Authorization: Bearer <accessToken>` to `service`, and nowhere else. */
  accessToken: string;
  tokenType: 'Bearer';
  /** Seconds the token was valid for when it was issued. */
  expiresIn: number;
  /** When it expires, in epoch milliseconds. */
  expiresAt: number;
  /** The `owner/service` it is for. */
  service: string;
}

/** The browser surfaces a token trip touches — injectable, so it can be tested. */
export interface TokenEnv {
  location: Pick<Location, 'origin' | 'href' | 'pathname' | 'search' | 'hash' | 'assign'>;
  history: Pick<History, 'replaceState' | 'state'>;
  /** `null` when the browser refuses storage — no trip can start or finish then. */
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  fetch: typeof fetch;
  now: () => number;
}

/** The page's own window as a [`TokenEnv`]. */
export function windowTokenEnv(win: Window = window): TokenEnv {
  let storage: TokenEnv['storage'];
  try {
    storage = win.sessionStorage;
  } catch {
    storage = null;
  }
  return { location: win.location, history: win.history, storage, fetch: win.fetch.bind(win), now: () => Date.now() };
}

/** `<auth>/authorize?mode=token&aud&client_origin&redirect&code_challenge&state`.
 *  The verifier is never in it: only its S256 challenge is. */
export function appTokenAuthorizeUrl(p: {
  authOrigin: string;
  owner: string;
  service: string;
  clientOrigin: string;
  redirect: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(`${p.authOrigin.replace(/\/+$/, '')}/authorize`);
  url.searchParams.set('mode', 'token');
  url.searchParams.set('aud', `boogy://${p.owner}/services/${p.service}`);
  url.searchParams.set('client_origin', p.clientOrigin);
  url.searchParams.set('redirect', p.redirect);
  url.searchParams.set('code_challenge', p.challenge);
  url.searchParams.set('state', p.state);
  return url.toString();
}

/**
 * Send the person to sign in to `service` for this page. Resolves as the page
 * leaves; the page at `redirect` then calls `completeAppToken()`.
 *
 * The service must name this page's origin in its
 * `[ingress.cors] allowed_origins` and register `redirect` in its
 * `[ingress.app_tokens] redirect_uris` — the platform refuses anything else.
 * Whether the service has a frontend of its own does not matter.
 * Rejects with `sign_in_unavailable`, starting nothing, when `redirect` is not
 * an absolute URL on this page's origin without a fragment.
 */
export async function requestAppToken(opts: AppTokenRequest, env: TokenEnv = windowTokenEnv()): Promise<void> {
  const { owner, service } = parseApp(opts.service);
  const authOrigin = (opts.authOrigin ?? platformConfig().authOrigin).replace(/\/+$/, '');
  // The session this trip ends in is kept only for an origin a token may be
  // sent to: https, or http on loopback, and nothing but the origin.
  if (!isTrustedOrigin(authOrigin)) {
    throw new BoogyError('config_unavailable', `not an auth origin: "${authOrigin}"`);
  }
  if (!env.storage) {
    throw new BoogyError('sign_in_unavailable', 'this browser keeps no session storage, so a sign-in cannot be finished here');
  }
  // Absolute, on this page's origin, without a fragment (the code comes back
  // in one) — and sent exactly as written: the platform compares it byte for
  // byte with the URLs the service registered, so it is never normalised here.
  const back = registeredReturnUrl(opts.redirect, env.location.origin);
  const verifier = randomVerifier();
  const state = randomState();
  try {
    env.storage.setItem(TOKEN_KEY, JSON.stringify({ state, verifier, authOrigin, service: `${owner}/${service}` }));
  } catch {
    throw new BoogyError('sign_in_unavailable', 'this browser refused to keep the sign-in in session storage');
  }
  const challenge = await s256Challenge(verifier);
  env.location.assign(
    appTokenAuthorizeUrl({
      authOrigin,
      owner,
      service,
      clientOrigin: env.location.origin,
      redirect: back,
      state,
      challenge,
    }),
  );
}

/** `redirect`, unchanged, if it can be a registered return URL for a page on
 *  `origin`: an absolute URL on that origin with no fragment. */
function registeredReturnUrl(redirect: unknown, origin: string): string {
  let url: URL | null = null;
  if (typeof redirect === 'string') {
    try {
      url = new URL(redirect);
    } catch {
      url = null;
    }
  }
  if (typeof redirect !== 'string' || !url || redirect.includes('#') || url.origin !== origin) {
    throw new BoogyError(
      'sign_in_unavailable',
      `redirect must be one of the service's registered return URLs, absolute and on this page's origin (${origin}), with no fragment: got ${JSON.stringify(redirect)}`,
    );
  }
  return redirect;
}

/** The fragment the platform sends the page back with. */
export interface TokenLanding {
  state: string;
  code: string | null;
  /** `consent_denied` when the person cancelled; then there is no code. */
  error: string | null;
}

/** Parse `#state=…&code=…` (or `#state=…&error=…`), or `null` when the
 *  fragment carries no trip. */
export function parseTokenLanding(hash: string): TokenLanding | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const state = params.get('state');
  const code = params.get('code');
  const error = params.get('error');
  if (!state || (!code && !error)) return null;
  return { state, code, error };
}

interface Trip {
  state: string;
  verifier: string;
  authOrigin: string;
  service: string;
}

function readTrip(storage: TokenEnv['storage']): Trip | null {
  try {
    const v: unknown = JSON.parse(storage?.getItem(TOKEN_KEY) ?? 'null');
    if (typeof v !== 'object' || v === null) return null;
    const { state, verifier, authOrigin, service } = v as Record<string, unknown>;
    const all = [state, verifier, authOrigin, service];
    if (!all.every((x) => typeof x === 'string' && x)) return null;
    return { state, verifier, authOrigin, service } as Trip;
  } catch {
    return null;
  }
}

/**
 * Finish a trip `requestAppToken` started, on the page it came back to. In this
 * order: read the fragment; drop it from the address bar and history; check its
 * `state` against the one this origin kept; forget the trip; redeem the code.
 *
 * Resolves `null` when the URL carries no trip, else the app token — and keeps
 * the session it grants in `session` (this website's storage, by default), for
 * `appTokenSession(service)` to renew. A session it replaces for the same
 * service is signed out at the platform, in the background, so no earlier
 * sign-in is left live. Rejects with a `BoogyError`:
 * `consent_denied` when the person cancelled, `sign_in_aborted` when the trip
 * is not one this page started or the platform refused the code, `network`
 * when the redeem could not be sent.
 */
export async function completeAppToken(
  env: TokenEnv = windowTokenEnv(),
  session?: SessionEnv,
): Promise<AppToken | null> {
  // 1. Read the fragment. One that carries no trip is the page's own business.
  const landing = parseTokenLanding(env.location.hash);
  if (!landing) return null;
  // 2. Drop it before anything else, so no code outlives this page in the
  //    address bar or in history.
  env.history.replaceState(env.history.state, '', `${env.location.pathname}${env.location.search}`);
  // 3. Only the trip this origin started may finish here. A fragment naming
  //    another `state` leaves the trip in flight alone.
  const trip = readTrip(env.storage);
  if (!trip || trip.state !== landing.state) {
    throw new BoogyError('sign_in_aborted', 'this sign-in was not started by this page');
  }
  // 4. Forget the trip: whatever happens next, it finishes once.
  try {
    env.storage?.removeItem(TOKEN_KEY);
  } catch {
    /* it expires with the tab */
  }
  if (landing.error === 'consent_denied') {
    throw new BoogyError('consent_denied', 'the person declined', trip.service);
  }
  if (!landing.code) {
    throw new BoogyError('sign_in_aborted', `the sign-in came back without a code (${landing.error})`, trip.service);
  }
  // 5. Redeem the code. No cookie travels either way: the token is the answer.
  const sessionEnv = session ?? windowSessionEnv();
  let res: Response;
  try {
    res = await env.fetch(`${trip.authOrigin}${TOKEN_PATH}`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grant_type: 'authorization_code', code: landing.code, verifier: trip.verifier }),
      signal: requestDeadline(sessionEnv),
    });
  } catch (e) {
    throw new BoogyError('network', e instanceof Error ? e.message : 'the token request failed', trip.service);
  }
  if (res.status !== 200) {
    throw new BoogyError('sign_in_aborted', `the platform refused the code (${res.status})`, trip.service);
  }
  let body: Record<string, unknown>;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new BoogyError('sign_in_aborted', 'the token response was not JSON', trip.service);
  }
  const record = sessionFromGrant(body, trip.authOrigin, env.now());
  if (!record) {
    throw new BoogyError('sign_in_aborted', 'the token response was not an app token', trip.service);
  }
  // 6. Keep the session — under the lock renewals take, so a renewal in
  //    another tab cannot overwrite it — and hand the page the access token
  //    and nothing else.
  await storeSession(sessionEnv, trip.service, record);
  return {
    accessToken: record.accessToken,
    tokenType: 'Bearer',
    expiresIn: body.expires_in as number,
    expiresAt: record.accessExpiresAt,
    service: trip.service,
  };
}
