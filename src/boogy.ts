import type { BoogyOptions, CurrentUser, Grant } from './types';
import { BoogyError } from './errors';
import { parseApp, parseApps, appOrigin, authOrigin, authorizeUrl } from './internal/urls';
import { randomVerifier, s256Challenge, randomState } from './internal/pkce';
import { setPkceCookie } from './internal/cookies';
import { runAuthFlow } from './internal/popup';
import { runInstallFlow, takeInstalled, type InstallModuleOptions, type Installed } from './internal/install-flow';

// ─── Silent re-authorization guards ────────────────────────────────────────
//
// A `401` from `Boogy.fetch` re-authorizes by driving `/authorize` again —
// but that flow can navigate the whole page away (`authMode: 'redirect'`),
// so doing it unconditionally is unsafe in two distinct ways this module
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
export class Boogy {
  private readonly authMode: 'popup' | 'redirect';
  private readonly renewAudiences?: () => readonly string[];

  constructor(options: BoogyOptions = {}) {
    this.authMode = options.authMode ?? 'popup';
    this.renewAudiences = options.renewAudiences;
  }

  // ─── App-origin tier ──────────────────────────────────────────────────────

  /**
   * Ensure a bootstrap session exists on the auth origin.
   *
   * In v1, the auth-origin session is established lazily the first time
   * `connectApp` or `fetch` drives the `/authorize` flow (the auth origin
   * checks for an existing session and prompts login if absent).
   * There is no standalone bootstrap endpoint, so calling `signIn()` without
   * a subsequent `connectApp`/`fetch` is a no-op — it resolves immediately.
   *
   * Expose this method to allow "Sign in" buttons that want to signal intent
   * before the user navigates to a specific app page.
   */
  async signIn(): Promise<void> {
    // No-op in v1: session bootstrap is driven lazily by connectApp / fetch.
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
   * Ensure a consent grant and a fresh `boogy_app` cookie for one or more apps.
   *
   * Runs the `/authorize` popup (or redirect) flow. `app` is either a single
   * `owner/service` app identifier, or a list of them — a batch signs every
   * app in one consent round-trip (e.g. every pane of a board), instead of
   * prompting once per app.
   *
   * A batch is validated locally, before any network request:
   * - every app in the batch must belong to the same owner (a batch that
   *   mixes owners is rejected, naming the app that doesn't match);
   * - a repeated app is silently collapsed to one;
   * - the platform accepts at most `MAX_AUDIENCES` distinct apps per
   *   authorization request — a larger batch is rejected, naming the count
   *   and the limit, rather than sent and refused with no detail.
   *
   * If a valid cookie already exists, call sites should check `currentUser`
   * first and skip calling this (the "no-op if already connected"
   * optimisation is left to the caller to avoid an extra network round-trip here).
   */
  /** The failing app first and always included, then `renewAudiences`'s apps
   *  — `connectApp` (via `parseApps`) dedupes the combined list and refuses it
   *  outright if it's over the cap or spans owners. */
  private renewalBatch(app: string): string | readonly string[] {
    const extra = this.renewAudiences?.() ?? [];
    return extra.length > 0 ? [app, ...extra] : app;
  }

  /**
   * Re-authorize `app` (with `renewAudiences`) because its session expired,
   * under the same guards as `fetch`'s renewal: only in a tab that has held a
   * session, at most once per cooldown, never after `signOut`.
   *
   * For an app whose own requests do not go through `fetch` — call it on a
   * `401` from them, or when `currentUser` answers signed-out in a tab that
   * was signed in (a tab reloaded after its session expired never sees a
   * `401` at all). Returns `true` when a renewal was started; in `redirect`
   * mode that navigates the page away. A failing renewal is logged, never
   * thrown.
   */
  renew(app: string): boolean {
    if (!canAttemptRenewal()) return false;
    let batch: string | readonly string[];
    try {
      batch = this.renewalBatch(app);
    } catch (e) {
      console.warn('[@boogy/web] Boogy.renew: renewAudiences failed.', e);
      return true;
    }
    this.connectApp(batch).catch((e) => {
      console.warn('[@boogy/web] Boogy.renew: silent renewal failed.', e);
    });
    return true;
  }

  async connectApp(app: string | readonly string[]): Promise<void> {
    const { owner, services } = parseApps(app);

    const verifier = randomVerifier();
    const challenge = await s256Challenge(verifier);
    const state = randomState();

    // Write the verifier into a short-lived, path-scoped cookie on the app origin.
    // The host's /boogy/callback (same origin) reads it to complete the PKCE exchange.
    setPkceCookie(verifier);

    const redirect = location.pathname + location.search;
    const url = authorizeUrl({ owner, services, redirect, state, codeChallenge: challenge, mode: this.authMode });

    await runAuthFlow({ authorizeUrl: url, appOrigin: appOrigin(owner), mode: this.authMode });

    // A completed authorization is as strong an "authenticated in this tab"
    // signal as a successful API response — arm here too, not only in
    // `fetch`, so a direct `connectApp` call (outside a 401 retry) also
    // arms renewal for a later expiry.
    noteAuthenticated();
  }

  /**
   * Fetch a resource on the given app, forwarding cookies (`credentials:'include'`).
   *
   * If the host responds with 401 AND this tab has previously seen an
   * authenticated response (from this method or a completed `connectApp`),
   * the SDK silently re-authorizes — runs `connectApp` once (popup/redirect
   * flow) and retries the request exactly once.  The retry result is returned
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
   * When `renewAudiences` was supplied to the constructor, a renewal
   * authorizes the failing app's own audience together with whatever that
   * function currently returns, in one consent round-trip — e.g. every pane
   * of a multi-app page — rather than renewing one app at a time as each
   * one's session happens to expire. The failing app is always included,
   * whatever `renewAudiences` returns: it's the request that actually 401'd.
   *
   * There is no truncation here: if the combined batch is over the
   * platform's per-request audience cap (`MAX_AUDIENCES`), `connectApp`
   * refuses it outright — the same as a batch that spans owners — rather
   * than silently signing in some of the apps and leaving the rest out.
   *
   * If the renewal attempt fails outright — `renewAudiences` itself throws,
   * or the batch is invalid (over the cap, or spanning owners) — that
   * failure does NOT propagate. It's logged via `console.warn` and the
   * original `401` `Response` is returned, exactly as if renewal had never
   * been attempted.
   *
   * HTTP error statuses (4xx / 5xx) are returned as-is and do NOT cause a throw.
   * Network / CORS failures throw `BoogyError('network')`.
   */
  async fetch(app: string, path: string, init?: RequestInit): Promise<Response> {
    const { owner, service } = parseApp(app);
    const url = `${appOrigin(owner)}/${service}${path}`;

    let res: Response;
    try {
      res = await globalThis.fetch(url, { ...init, credentials: 'include' });
    } catch (e) {
      throw new BoogyError('network', e instanceof Error ? e.message : String(e), app);
    }

    if (res.status === 401 && canAttemptRenewal()) {
      // `canAttemptRenewal()` above has already written the cooldown mark,
      // BEFORE anything below runs — deliberately. A renewal attempt that
      // fails right here (a broken `renewAudiences`, or a batch this SDK's
      // own local validation rejects) still burns the cooldown window, so a
      // caller stuck in this state gets one attempt per window rather than
      // retrying — and failing — on every single request. Do not "fix" this
      // by moving the mark after a successful renewal.
      let renewed = false;
      try {
        const audiences = this.renewalBatch(app);
        await this.connectApp(audiences);
        renewed = true;
      } catch (e) {
        // Renewal is an optimisation on top of an ordinary 401 — its failure
        // must never turn that 401 into an exception the caller's error
        // handling isn't expecting. Reached when `renewAudiences` itself
        // throws, or when the batch is invalid (over the cap, or spanning
        // owners). Fall through and return the original 401 below, but say so
        // loudly enough that a developer whose provider is broken can find out.
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
   * GETs `<app-origin>/boogy/me?service=<service>` with `credentials:'include'`.
   * The host returns either a JSON `{pairwiseId, connectedAt}` object or the
   * literal JSON `null` (both on 200).  Any non-200, parse failure, or network
   * error returns `null` without throwing — this is a pure read-only probe.
   *
   * `?service=` is what makes the answer be about THIS app.  The app-session
   * cookie is named per service and one tenant origin serves every one of that
   * owner's services, so an unnamed `/boogy/me` answers with whichever session on
   * the origin verifies first — i.e. with the browser's cookie-header order.  On
   * an origin with sibling apps that can be a different app's session, and this
   * probe would report a user who is not signed in to `app` at all.
   */
  async currentUser(app: string): Promise<CurrentUser | null> {
    const { owner, service } = parseApp(app);
    const url = `${appOrigin(owner)}/boogy/me?service=${encodeURIComponent(service)}`;

    try {
      const res = await globalThis.fetch(url, { credentials: 'include' });
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
   * - `signOut(app)` — POSTs `<app-origin>/boogy/logout?service=<service>` with
   *   `credentials:'include'` to clear the app-session cookie for that specific
   *   app.  Never throws (best-effort).
   *
   *   `?service=` is what makes "that specific app" true.  The cookie is named
   *   per service, and an UNNAMED logout emits a clearing header for every app
   *   session on the origin — so signing out of one app under a handle signed the
   *   user out of every sibling app under it too. (Where the origin holds one
   *   session covering every pane, the platform clears that one session.)
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
      const url = `${appOrigin(owner)}/boogy/logout?service=${encodeURIComponent(service)}`;
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
