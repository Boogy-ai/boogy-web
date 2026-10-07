import type { BoogyOptions, CurrentUser, Grant } from './types';
import { BoogyError } from './errors';
import { parseApp, appOrigin, appBaseUrl, authOrigin } from './internal/urls';
import { runInstallFlow, takeInstalled, type InstallModuleOptions, type Installed } from './internal/install-flow';
import { loadPlatformConfig, type PlatformConfig } from './internal/platform-config';
import { requestSignInFromFramer } from './pane';

// ─── Silent re-authorization guards ────────────────────────────────────────
//
// A `401` from `Boogy.fetch` re-authorizes by sending the person through the
// platform's sign-in again — but that can navigate the whole page away, so
// doing it unconditionally is unsafe in two distinct ways this module
// guards against:
//
// 1. A caller who has never held a session would be bounced to `/authorize`
//    on their very first `401` — turning a public, signed-out page into a
//    forced sign-in before the visitor ever asked for one. Fixed by only
//    attempting renewal once this tab has SEEN a session succeed.
// 2. If the platform session has also expired, or consent was withdrawn, the
//    return trip 401s again — and without a cooldown that is an unbounded
//    retry loop, worse than simply landing on a signed-out page.
//
// `sessionStorage` (not an in-memory flag) is what makes the cooldown
// survive a renewal that navigates the page away, and it is deliberately
// per-tab: a brand-new tab does not inherit another tab's renewal history,
// so it shows the signed-out page rather than renewing on an assumption.
const SAW_SESSION_KEY = 'boogy.sdk.saw-session.v1';
const RENEWING_MARK_KEY = 'boogy.sdk.renewing.v1';
const RENEW_COOLDOWN_MS = 60_000;

/**
 * Record that this tab has held an authenticated session, and clear any
 * standing cooldown — reaching an authenticated answer is the proof a
 * renewal (if one was in flight) worked, so a later expiry gets a fresh
 * attempt rather than inheriting an old one's cooldown.
 */
function noteAuthenticated(): void {
  try {
    sessionStorage.setItem(SAW_SESSION_KEY, '1');
    sessionStorage.removeItem(RENEWING_MARK_KEY);
  } catch {
    // Hardened browser settings can make storage throw. Renewal then simply
    // never fires, which is the safe direction: the person signs in by hand,
    // exactly as they would without this feature.
  }
}

/**
 * Forget that this tab held a session, so a later `401` reads as an ordinary
 * sign-out rather than an expiry to rescue.
 */
function forgetSession(): void {
  try {
    sessionStorage.removeItem(SAW_SESSION_KEY);
    sessionStorage.removeItem(RENEWING_MARK_KEY);
  } catch {
    // Unreadable storage means renewal was never armed in the first place.
  }
}

/**
 * Decide whether a `401` may attempt renewal right now, and if so, mark the
 * attempt immediately (before the caller does anything network-bound) so a
 * second `401` inside the cooldown window can't slip through.
 *
 * Every storage failure resolves to "do not renew" — the safe direction.
 */
function canAttemptRenewal(): boolean {
  let sawSession = false;
  let marked: string | null = null;
  try {
    sawSession = sessionStorage.getItem(SAW_SESSION_KEY) === '1';
    marked = sessionStorage.getItem(RENEWING_MARK_KEY);
  } catch {
    return false;
  }
  if (!sawSession) return false;
  if (marked && Date.now() - Number(marked) < RENEW_COOLDOWN_MS) return false;
  try {
    sessionStorage.setItem(RENEWING_MARK_KEY, String(Date.now()));
  } catch {
    return false;
  }
  return true;
}

/**
 * Main entry point for the `@boogy/web` SDK.
 *
 * @example
 * ```ts
 * const boogy = new Boogy();
 * await boogy.connectApp('alice/my-service');
 * const user = await boogy.currentUser('alice/my-service');
 * ```
 */
/**
 * In a frame, sign-in must neither open a popup nor navigate: the board
 * framing it owns sign-in. A frame whose `top` cannot even be compared counts
 * as framed.
 */
function isFramed(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

/** This origin's platform configuration, or null when the platform did not
 *  answer — then this page is taken to be on no origin that names a service. */
async function configHere(): Promise<PlatformConfig | null> {
  try {
    return await loadPlatformConfig();
  } catch {
    return null;
  }
}

/** Whether this origin holds a session (for the one service it
 *  serves): `GET /boogy/me` on this page's own origin. Any failure reads as
 *  signed out. */
async function signedInHere(): Promise<boolean> {
  try {
    const res = await globalThis.fetch('/boogy/me', { credentials: 'same-origin' });
    if (res.status !== 200) return false;
    return (await res.json()) !== null;
  } catch {
    return false;
  }
}

/**
 * `path` on `origin`, for a request that carries the app's cookies — refused
 * with `url_not_allowed` unless it stays on that origin. `path` must start
 * with exactly one `/`: anything else joined onto an origin can name another
 * host or port (`.evil.example/x`, `:8443/x`, `//evil.example`, `/\\evil`).
 */
function onOrigin(origin: string, path: string, app: string): string {
  const url = `${origin}${path}`;
  let stays = path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
  if (stays) {
    try {
      stays = new URL(url).origin === new URL(origin).origin;
    } catch {
      stays = false;
    }
  }
  if (!stays) {
    throw new BoogyError('url_not_allowed', `"${path}" is not a path on ${app}'s address: it must start with exactly one "/".`, app);
  }
  return url;
}

/**
 * `/boogy/signin` on this origin, for the one service it serves (the platform
 * knows which; none is named here): the platform
 * starts the classic sign-in there — it keeps the PKCE verifier itself — and
 * brings the person back to `redirect`, a path on this origin.
 */
function labelSignInUrl(): string {
  const query = new URLSearchParams({
    // A path, with leading slashes collapsed: `//host` would name another host.
    redirect: location.pathname.replace(/^\/+/, '/') + location.search,
  });
  return `/boogy/signin?${query}`;
}

/**
 * Where an app's sign-in is the platform's to make rather than this page's —
 * in a frame, or on an origin that names its one service (a service's own
 * label, a verified custom domain, a designated reserved label; the platform
 * names none anywhere else) — `true` once it is taken care of:
 * - signed in already (this origin's own session): nothing more to do;
 * - framed and signed out: the page framing this one is told so and asked, and
 *   it is leaving for sign-in (or says the app is signed in after all);
 * - shown alone and signed out: the page goes to this origin's own
 *   `/boogy/signin`, and never settles, since it is leaving.
 * Rejects `sign_in_busy` when the page framing this one says a sign-in went too
 * recently, `sign_in_unavailable` when no such page is connected or none
 * answered, and `app_not_found` for a sign-in, framed or not, for an app the
 * origin does not serve. `false` elsewhere: the classic sign-in is this page's
 * to make.
 *
 * A frame never starts a sign-in itself: the sign-in page refuses to be framed.
 */
async function signInByPlatform(app?: string): Promise<boolean> {
  const config = await configHere();
  const service = config?.service;
  const framed = isFramed();
  if (!framed && service === undefined) return false;
  // An origin that names its one service serves no other, framed or not.
  if (config && service !== undefined && app !== undefined && app !== `${config.owner}/${service}`) {
    throw new BoogyError('app_not_found', `"${app}" is not served here: this origin serves only "${config.owner}/${service}".`, app);
  }
  if (!framed && config && service !== undefined) {
    if (await signedInHere()) return true;
    location.assign(labelSignInUrl());
    return new Promise<never>(() => {});
  }
  if (await signedInHere()) return true;
  const result = await requestSignInFromFramer();
  if (result === 'leaving' || result === 'already_signed_in') return true;
  if (typeof result === 'object') {
    throw new BoogyError(
      'sign_in_busy',
      `A sign-in went moments ago. Try again in ${Math.ceil(result.busy / 1000)} seconds.`,
      app,
    );
  }
  console.warn('[@boogy/web] sign-in: this app is signed in by the page framing it, and none answered.');
  throw new BoogyError(
    'sign_in_unavailable',
    'This app is signed in by the page that shows it, and no such page is connected. Open the app at its own address.',
    app,
  );
}

export class Boogy {
  private readonly authMode: 'popup' | 'redirect';

  constructor(options: BoogyOptions = {}) {
    this.authMode = options.authMode ?? 'popup';
  }

  // ─── App-origin tier ──────────────────────────────────────────────────────

  /**
   * Sign the person in to the one app this origin serves.
   *
   * On an origin that names its one service — a service's own label, a
   * verified custom domain, a designated reserved label — it resolves at once
   * when this origin already holds a session. Signed out and shown alone, the
   * page goes to this origin's own `/boogy/signin` (and never settles: it is
   * leaving). In a frame, the page framing this one is asked to sign the app
   * in (see `connectApp`).
   *
   * Anywhere else — an origin that names no single service — there is no one
   * app to sign in to, and it resolves at once without doing anything: name
   * the app with `connectApp(app)` or `fetch` there.
   */
  async signIn(): Promise<void> {
    // In a frame, or on an origin that names its one service: resolved at once
    // when this origin holds a session, else the platform signs it in.
    if (await signInByPlatform()) return;
    // Elsewhere there is no one app to sign in to; `connectApp(app)` names one.
    return;
  }

  /**
   * Ask the person to install a module into their account.
   *
   * Opens the platform's install page (a popup, or the whole page in
   * `redirect` mode), where the person reviews the module and confirms. An
   * app can never install anything by itself: only that page, on the
   * platform's sign-in origin, can.
   *
   * Popup mode resolves with the new service once the person confirms, and
   * rejects `install_cancelled` if they cancel, `install_aborted` if they
   * close the window, or `popup_blocked`. Redirect mode navigates away and
   * never settles; on return, read the result with `Boogy.takeInstalled()`.
   */
  install(options: InstallModuleOptions): Promise<Installed> {
    return runInstallFlow(options, this.authMode);
  }

  /**
   * After a redirect-mode `install()`: the new service's id, or null. Reads
   * it once and removes it from the address.
   */
  static takeInstalled(): string | null {
    return takeInstalled();
  }

  /**
   * Re-authorize `app` because its session expired, under the same guards as
   * `fetch`'s renewal: only in a tab that has held a session, at most once per
   * cooldown, never after `signOut` — and never in a frame, where the board
   * owns sign-in. Try `refreshSession` first: it renews with no page
   * change.
   *
   * For an app whose own requests do not go through `fetch` — call it on a
   * `401` from them, or when `currentUser` answers signed-out in a tab that
   * was signed in (a tab reloaded after its session expired never sees a
   * `401` at all). Returns `true` when a renewal was started; in `redirect`
   * mode that navigates the page away. A failing renewal is logged, never
   * thrown.
   */
  renew(app: string): boolean {
    // Framed: never — the board signs this app in (see `isFramed`).
    if (isFramed() || !canAttemptRenewal()) return false;
    this.connectApp(app).catch((e) => {
      console.warn('[@boogy/web] Boogy.renew: silent renewal failed.', e);
    });
    return true;
  }

  /**
   * Swap this site's renewal cookie for a fresh app session, with no page
   * change: `POST <app-origin>/boogy/renew`.
   *
   * Only from the app's own origin — the cookie lives there, and the platform
   * refuses the request from anywhere else — so for an app on another origin
   * this resolves `false` without a request. `true` when a fresh session was
   * set, which also arms the redirect renewal for a later expiry. Never throws.
   */
  async refreshSession(app: string): Promise<boolean> {
    let origin: string;
    try {
      const { owner, service } = parseApp(app);
      origin = appOrigin(owner, service);
    } catch {
      return false;
    }
    if (location.origin !== origin) return false;
    try {
      const res = await globalThis.fetch(`${origin}/boogy/renew`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (res.ok) noteAuthenticated();
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Ensure a consent grant and a fresh `boogy_app` cookie for ONE app.
   *
   * An app session covers exactly one service, so this names one
   * `owner/service` app, and the platform makes the sign-in: this page runs none
   * of its own.
   *
   * On an origin that names its one service (a service's own label, a
   * verified custom domain, a designated reserved label), shown alone, the
   * platform runs that sign-in: when this origin already holds a session it
   * resolves at once, and otherwise the page goes to its own `/boogy/signin`
   * (a redirect) and never settles. Such an origin
   * serves one service, so an `app` naming another rejects with
   * `app_not_found`, framed or not.
   *
   * In a frame it starts no sign-in. When this origin already holds a session
   * it resolves at once; otherwise it tells the board framing this one the app
   * is signed out and asks it to make the trip, as `PaneHandle.requestSignIn`
   * does, resolving once that page is leaving. It rejects with `sign_in_busy`
   * when that page says a sign-in went moments ago, and `sign_in_unavailable`
   * when no such page is connected or answers.
   *
   * On any other origin — one the platform names no service for — there is no
   * sign-in to make: it rejects with `sign_in_unavailable` and goes nowhere.
   *
   * If a valid cookie already exists, call sites should check `currentUser`
   * first and skip calling this (the "no-op if already connected"
   * optimisation is left to the caller to avoid an extra network round-trip here).
   */
  async connectApp(app: string): Promise<void> {
    parseApp(app);

    // In a frame, or on an origin that names its one service, the platform
    // makes the trip: the board framing this page, or its `/boogy/signin`.
    if (await signInByPlatform(app)) return;

    // Anywhere else the page has no sign-in of its own to run: a service's
    // address, a board's, or an app token's is where a person signs in.
    throw new BoogyError(
      'sign_in_unavailable',
      'This origin signs in through the platform only, and names no service to sign in to. Open the app at its own address.',
      app,
    );
  }

  /**
   * Fetch a resource on the given app, forwarding cookies (`credentials:'include'`).
   *
   * On a 401 the SDK first renews SILENTLY — `refreshSession`, one same-origin
   * request swapping this site's renewal cookie for a fresh session, no page
   * change — and on success retries the request exactly once.
   *
   * Only if that could not help, AND this tab has previously seen an
   * authenticated response (from this method or a completed `connectApp`), AND
   * the page is not framed (a board owns its frames' sign-in), does it
   * re-authorize — runs `connectApp(app)` once (popup/redirect flow) and retries
   * the request exactly once.  The retry result is returned
   * as-is — there is NO second retry even if the retried response is also 401.
   *
   * Silent renewal is guarded, in this order:
   * - **Never for a caller that has never held a session.** A 401 for a
   *   first-time, never-signed-in visitor is returned as-is rather than
   *   triggering a sign-in prompt (or, in `redirect` mode, navigating them
   *   away) that they never asked for.
   * - **At most once per 60-second cooldown.** If the platform session has
   *   also expired, or consent was withdrawn, the renewed request 401s
   *   again — without this, that is an unbounded retry loop.
   * - **Never right after `signOut`**, which clears the "session held"
   *   marker before it issues its own request, so a 401 racing a sign-out
   *   cannot re-authorize the very session being ended.
   *
   * If the renewal attempt fails outright, that failure does NOT propagate.
   * It's logged via `console.warn` and the original `401` `Response` is
   * returned, exactly as if renewal had never been attempted.
   *
   * `path` is a path on the app's own address, starting with exactly one
   * `/`; anything else rejects with `BoogyError('url_not_allowed')`, sending
   * nothing, since joined onto the origin it could name another host or port.
   *
   * HTTP error statuses (4xx / 5xx) are returned as-is and do NOT cause a throw.
   * Network / CORS failures throw `BoogyError('network')`.
   */
  async fetch(app: string, path: string, init?: RequestInit): Promise<Response> {
    const { owner, service } = parseApp(app);
    const url = onOrigin(appBaseUrl(owner, service), path, app);

    let res: Response;
    try {
      res = await globalThis.fetch(url, { ...init, credentials: 'include' });
    } catch (e) {
      throw new BoogyError('network', e instanceof Error ? e.message : String(e), app);
    }

    // Silent renewal first: no page change, no cooldown — it is one cheap
    // same-origin request, and a failure falls through to the 401 below.
    if (res.status === 401 && (await this.refreshSession(app))) {
      try {
        res = await globalThis.fetch(url, { ...init, credentials: 'include' });
      } catch (e) {
        throw new BoogyError('network', e instanceof Error ? e.message : String(e), app);
      }
    }

    // Then the round trip — never in a frame, where the board owns sign-in.
    if (res.status === 401 && !isFramed() && canAttemptRenewal()) {
      // `canAttemptRenewal()` above has already written the cooldown mark,
      // BEFORE anything below runs — deliberately. A renewal attempt that
      // fails right here still burns the cooldown window, so a caller stuck in
      // this state gets one attempt per window rather than retrying — and
      // failing — on every single request. Do not "fix" this by moving the
      // mark after a successful renewal.
      let renewed = false;
      try {
        await this.connectApp(app);
        renewed = true;
      } catch (e) {
        // Renewal is an optimisation on top of an ordinary 401 — its failure
        // must never turn that 401 into an exception the caller's error
        // handling isn't expecting. Fall through and return the original 401
        // below, but say so loudly enough that a developer can find out.
        console.warn('[@boogy/web] Boogy.fetch: silent renewal failed; returning the original 401.', e);
      }
      if (renewed) {
        try {
          res = await globalThis.fetch(url, { ...init, credentials: 'include' });
        } catch (e) {
          throw new BoogyError('network', e instanceof Error ? e.message : String(e), app);
        }
      }
    }

    if (res.ok) noteAuthenticated();

    return res;
  }

  /**
   * Check whether an end-user is currently authenticated on the given app.
   *
   * GETs `<app-origin>/boogy/me` with `credentials:'same-origin'`.
   * The host returns either a JSON `{pairwiseId, connectedAt}` object or the
   * literal JSON `null` (both on 200).  Any non-200, parse failure, or network
   * error returns `null` without throwing — this is a pure read-only probe.
   *
   * The answer is about the one app this origin serves: naming any other app
   * rejects with `app_not_found` before anything is sent.
   */
  async currentUser(app: string): Promise<CurrentUser | null> {
    const { owner, service } = parseApp(app);
    const url = `${appOrigin(owner, service)}/boogy/me`;

    try {
      const res = await globalThis.fetch(url, { credentials: 'same-origin' });
      if (res.status !== 200) return null;
      const body = await res.json();
      if (body === null) return null;
      // A resolved session is as strong an "authenticated in this tab" signal
      // as a successful request: it arms renewal for a later expiry.
      noteAuthenticated();
      return body as CurrentUser;
    } catch {
      return null;
    }
  }

  /**
   * Sign the user out.
   *
   * - `signOut(app)` — POSTs `<app-origin>/boogy/logout` with
   *   `credentials:'include'` to clear the app's session: the origin's one
   *   session, which covers that one app.  Never throws (best-effort).
   *
   * - `signOut({ all: true })` — POSTs `<auth-origin>/_agents/logout` with
   *   `credentials:'include'` to clear the global bootstrap session.
   *
   *   **v1 limitation**: `/_agents/logout` lives on the auth origin
   *   (`https://auth.<base>`), which is cross-origin relative to any tenant app
   *   page.  The browser will send the POST but CORS will block the response
   *   unless the auth origin has a permissive CORS policy for the calling origin.
   *   In practice the global session will expire on its own; per-app cookies can
   *   always be cleared via `signOut(app)`.  This method catches the CORS / network
   *   error and resolves regardless — it is explicitly best-effort.
   *
   * Resolves `true` when the platform confirmed the sign-out (a 2xx), `false`
   * otherwise — the cookie may then still be set. Never throws.
   */
  async signOut(target: string | { all: true }): Promise<boolean> {
    // Clear the "session held" marker FIRST — before either branch below
    // issues its own request, not after. Silent renewal fires on the very
    // next 401, which a sign-out's own logout call produces on this app's
    // subsequent requests; clearing after the request would leave a window
    // in which a 401 racing the logout still sees an armed session and
    // re-authorizes it, signing the person back in during their own sign-out.
    forgetSession();

    if (typeof target === 'string') {
      const { owner, service } = parseApp(target);
      const url = `${appOrigin(owner, service)}/boogy/logout`;
      // Never throws: an HTTP error or network failure resolves `false`.
      try {
        const res = await globalThis.fetch(url, { method: 'POST', credentials: 'include' });
        return res.ok;
      } catch {
        return false;
      }
    } else {
      // target.all === true
      const url = `${authOrigin()}/_agents/logout`;
      // Best-effort POST — see JSDoc for the v1 CORS limitation.
      try {
        const res = await globalThis.fetch(url, { method: 'POST', credentials: 'include' });
        return res.ok;
      } catch {
        // CORS rejection is expected from tenant origins (see above).
        return false;
      }
    }
  }

  // ─── Dashboard tier (dashboard origin only) ───────────────────────────────

  /**
   * List all consent grants the current user has issued.
   *
   * GETs `<auth-origin>/_agents/grants` with `credentials:'include'`.
   * Returns an array of `Grant` objects, each describing an app the user has
   * connected and when it was last used.
   *
   * **Dashboard context only.** This endpoint is restricted to the dashboard
   * origin via CORS.  Calling this method from a tenant app origin will cause
   * the browser to block the credentialed cross-origin request with a
   * `TypeError`, which the SDK surfaces as `BoogyError('network')` with a
   * message noting that grant management is only available from the dashboard
   * origin.
   */
  async listGrants(): Promise<Grant[]> {
    const url = `${authOrigin()}/_agents/grants`;
    let res: Response;
    try {
      res = await globalThis.fetch(url, { credentials: 'include' });
    } catch {
      throw new BoogyError(
        'network',
        'grant management is available from the dashboard origin only',
      );
    }
    if (!res.ok) {
      throw new BoogyError('network', `Failed to list grants: ${res.status}`);
    }
    return res.json() as Promise<Grant[]>;
  }

  /**
   * Revoke the consent grant for the given app.
   *
   * DELETEs `<auth-origin>/_agents/grants/{owner}/{service}` with
   * `credentials:'include'`.  Resolves on `2xx` or `404` — a 404 means the
   * grant no longer exists, which is treated as success (idempotent).
   *
   * **Dashboard context only.** This endpoint is restricted to the dashboard
   * origin via CORS.  Calling this method from a tenant app origin will cause
   * the browser to block the credentialed cross-origin request with a
   * `TypeError`, which the SDK surfaces as `BoogyError('network')` with a
   * message noting that grant management is only available from the dashboard
   * origin.
   */
  async revokeApp(app: string): Promise<void> {
    const { owner, service } = parseApp(app);
    const url = `${authOrigin()}/_agents/grants/${owner}/${service}`;
    let res: Response;
    try {
      res = await globalThis.fetch(url, { method: 'DELETE', credentials: 'include' });
    } catch {
      throw new BoogyError(
        'network',
        'grant management is available from the dashboard origin only',
      );
    }
    // 2xx or 404 are both fine (idempotent)
    if (!res.ok && res.status !== 404) {
      throw new BoogyError('network', `Failed to revoke app grant: ${res.status}`);
    }
  }
}
