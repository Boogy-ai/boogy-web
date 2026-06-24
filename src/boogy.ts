import type { BoogyOptions, CurrentUser, Grant } from './types';
import { BoogyError } from './errors';
import { parseApp, baseFromHost, appOrigin, authOrigin, authorizeUrl } from './internal/urls';
import { randomVerifier, s256Challenge, randomState } from './internal/pkce';
import { setPkceCookie } from './internal/cookies';
import { runAuthFlow } from './internal/popup';

/**
 * Main entry point for the `@boogy/web` SDK.
 *
 * @example
 * ```ts
 * const boogy = new Boogy({ host: 'https://boogy.ai' });
 * await boogy.connectApp('alice/my-service');
 * const user = await boogy.currentUser('alice/my-service');
 * ```
 */
export class Boogy {
  private readonly host: string;
  private readonly authMode: 'popup' | 'redirect';

  constructor(options: BoogyOptions) {
    this.host = options.host;
    this.authMode = options.authMode ?? 'popup';
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
   * Ensure a consent grant and a fresh `boogy_app` cookie for `app`.
   *
   * Runs the `/authorize` popup (or redirect) flow for the given `owner/service`
   * app identifier. If a valid cookie already exists, call sites should check
   * `currentUser` first and skip calling this (the "no-op if already connected"
   * optimisation is left to the caller to avoid an extra network round-trip here).
   */
  async connectApp(app: string): Promise<void> {
    const { owner, service } = parseApp(app);
    const base = baseFromHost(this.host);

    const verifier = randomVerifier();
    const challenge = await s256Challenge(verifier);
    const state = randomState();

    // Write the verifier into a short-lived, path-scoped cookie on the app origin.
    // The host's /boogy/callback (same origin) reads it to complete the PKCE exchange.
    setPkceCookie(verifier);

    const redirect = location.pathname + location.search;
    const url = authorizeUrl({ base, owner, service, redirect, state, codeChallenge: challenge, mode: this.authMode });

    await runAuthFlow({ authorizeUrl: url, appOrigin: appOrigin(owner, base), mode: this.authMode });
  }

  /**
   * Fetch a resource on the given app, forwarding cookies (`credentials:'include'`).
   *
   * If the host responds with 401 the SDK runs `connectApp` once (popup/redirect
   * auth flow) and retries the request exactly once.  The retry result is returned
   * as-is — there is NO second retry even if the retried response is also 401.
   *
   * HTTP error statuses (4xx / 5xx) are returned as-is and do NOT cause a throw.
   * Network / CORS failures throw `BoogyError('network')`.
   */
  async fetch(app: string, path: string, init?: RequestInit): Promise<Response> {
    const { owner, service } = parseApp(app);
    const base = baseFromHost(this.host);
    const url = `${appOrigin(owner, base)}/${service}${path}`;

    let res: Response;
    try {
      res = await globalThis.fetch(url, { ...init, credentials: 'include' });
    } catch (e) {
      throw new BoogyError('network', e instanceof Error ? e.message : String(e), app);
    }

    if (res.status === 401) {
      await this.connectApp(app);
      try {
        res = await globalThis.fetch(url, { ...init, credentials: 'include' });
      } catch (e) {
        throw new BoogyError('network', e instanceof Error ? e.message : String(e), app);
      }
    }

    return res;
  }

  /**
   * Check whether an end-user is currently authenticated on the given app.
   *
   * GETs `<app-origin>/boogy/me` with `credentials:'include'`.  The host returns
   * either a JSON `{pairwiseId, connectedAt}` object or the literal JSON `null`
   * (both on 200).  Any non-200, parse failure, or network error returns `null`
   * without throwing — this is a pure read-only probe.
   */
  async currentUser(app: string): Promise<CurrentUser | null> {
    const { owner } = parseApp(app);
    const base = baseFromHost(this.host);
    const url = `${appOrigin(owner, base)}/boogy/me`;

    try {
      const res = await globalThis.fetch(url, { credentials: 'include' });
      if (res.status !== 200) return null;
      const body = await res.json();
      if (body === null) return null;
      return body as CurrentUser;
    } catch {
      return null;
    }
  }

  /**
   * Sign the user out.
   *
   * - `signOut(app)` — POSTs `<app-origin>/boogy/logout` with `credentials:'include'`
   *   to clear the `boogy_app` cookie for that specific app.  Resolves on any
   *   HTTP response (best-effort).
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
   */
  async signOut(target: string | { all: true }): Promise<void> {
    const base = baseFromHost(this.host);

    if (typeof target === 'string') {
      const { owner } = parseApp(target);
      const url = `${appOrigin(owner, base)}/boogy/logout`;
      // Best-effort: ignore both HTTP errors and network failures.
      try {
        await globalThis.fetch(url, { method: 'POST', credentials: 'include' });
      } catch {
        // swallow — best-effort
      }
    } else {
      // target.all === true
      const url = `${authOrigin(base)}/_agents/logout`;
      // Best-effort POST — see JSDoc for the v1 CORS limitation.
      try {
        await globalThis.fetch(url, { method: 'POST', credentials: 'include' });
      } catch {
        // swallow — best-effort (CORS rejection is expected from tenant origins)
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
    const base = baseFromHost(this.host);
    const url = `${authOrigin(base)}/_agents/grants`;
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
    const base = baseFromHost(this.host);
    const url = `${authOrigin(base)}/_agents/grants/${owner}/${service}`;
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
