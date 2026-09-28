import { BoogyError } from '../errors';

/** Parameters for the authorization flow. */
export interface FlowParams {
  /** The full `/authorize` URL to open. */
  authorizeUrl: string;
  /** The app origin that will postMessage back (e.g. `https://alice.boogy.ai`). */
  appOrigin: string;
  /** 'popup' (default) opens a popup window; 'redirect' navigates the top-level page. */
  mode: 'popup' | 'redirect';
}

/** Key used in sessionStorage to persist redirect-flow state across the navigation. */
const SSO_PENDING_KEY = 'boogy_sso_pending';

/**
 * Drive the `/authorize` flow.
 *
 * Popup mode (default):
 *   - Opens `authorizeUrl` in a small popup window named `boogy_sso`.
 *   - Resolves when the callback page postMessages `{ boogy: 'sso_done' }` with
 *     `event.origin === appOrigin`.
 *   - Rejects `BoogyError('consent_denied')` on `{ boogy: 'sso_cancelled' }` (same origin).
 *   - Rejects `BoogyError('popup_blocked')` if `window.open` returns null.
 *   - Rejects `BoogyError('sign_in_aborted')` if the popup closes before any SSO message.
 *   - Messages from any origin other than `appOrigin` are silently ignored.
 *
 * Redirect mode:
 *   - Persists `{ returnTo: location.href }` to sessionStorage under `boogy_sso_pending`.
 *   - Calls `location.assign(authorizeUrl)` and returns a never-resolving promise
 *     (the page navigates away).
 *   - On return, call `resumeRedirect()` to detect and clear the pending state.
 */
export function runAuthFlow(p: FlowParams): Promise<void> {
  if (p.mode === 'redirect') {
    return runRedirectFlow(p);
  }
  return runPopupFlow(p);
}

// ─── Popup mode ───────────────────────────────────────────────────────────────

function runPopupFlow({ authorizeUrl, appOrigin }: FlowParams): Promise<void> {
  return awaitPopup<void>({
    url: authorizeUrl,
    name: 'boogy_sso',
    origin: appOrigin,
    blocked: () => new BoogyError('popup_blocked', 'The sign-in popup was blocked by the browser.'),
    aborted: () => new BoogyError('sign_in_aborted', 'The sign-in popup was closed before completion.'),
    decide(data) {
      const boogy = (data as { boogy?: string } | null)?.boogy;
      if (boogy === 'sso_done') return { value: undefined };
      if (boogy === 'sso_cancelled') return { error: new BoogyError('consent_denied', 'The user cancelled the sign-in.') };
      return null;
    },
  });
}

/** What a popup's message decides: settle with a value, fail, or (null) keep waiting. */
export type PopupDecision<T> = { value: T } | { error: BoogyError } | null;

export interface PopupParams<T> {
  url: string;
  /** The window name, so a second request reuses the same popup. */
  name: string;
  /** The only origin whose messages are read. Every other message is ignored. */
  origin: string;
  blocked(): BoogyError;
  /** The popup closed before a deciding message. */
  aborted(): BoogyError;
  decide(data: unknown): PopupDecision<T>;
  /** Stops waiting: rejects with `aborted()` and stops reading messages. */
  signal?: AbortSignal;
}

/**
 * Open a popup and settle on the first message from `origin` that `decide`
 * accepts, or reject when the popup is blocked or closed first.
 */
export function awaitPopup<T>(p: PopupParams<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const popup = window.open(p.url, p.name, 'popup,width=480,height=640');

    if (!popup) {
      reject(p.blocked());
      return;
    }

    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(closedPoll);
      // Superseded: the next call has taken over this window, so leave it open.
      if (p.signal?.aborted) return;
      // Best-effort: close the popup if it is still open.
      try {
        if (!popup.closed) popup.close();
      } catch {
        // Swallow cross-origin close errors (popup may already be gone).
      }
    };

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const onMessage = (event: MessageEvent) => {
      // Strictly check the origin — ignore any message not from the expected one.
      if (event.origin !== p.origin) return;
      const d = p.decide(event.data);
      if (!d) return;
      if ('error' in d) settle(() => reject(d.error));
      else settle(() => resolve(d.value));
    };

    window.addEventListener('message', onMessage);
    p.signal?.addEventListener('abort', () => settle(() => reject(p.aborted())), { once: true });

    // Poll for popup closure: closed before a deciding message means abandoned.
    const closedPoll = setInterval(() => {
      if (popup.closed) settle(() => reject(p.aborted()));
    }, 300);
  });
}

// ─── Redirect mode ────────────────────────────────────────────────────────────

function runRedirectFlow({ authorizeUrl }: FlowParams): Promise<void> {
  sessionStorage.setItem(
    SSO_PENDING_KEY,
    JSON.stringify({ returnTo: location.href }),
  );
  location.assign(authorizeUrl);
  // The page navigates away — this promise intentionally never settles.
  // The caller on the redirect-back page should call resumeRedirect() to handle the return.
  return new Promise<void>(() => {});
}

/**
 * Detect a pending redirect-mode SSO flow on the redirect-back page.
 *
 * Call this on page load to check whether this is a redirect-back from an SSO flow.
 * Returns `true` and clears the sessionStorage entry if a pending flow is found;
 * returns `false` otherwise.
 *
 * Minimal v1 implementation: callers can use the return value to trigger any
 * post-sign-in logic (e.g. retry the original navigation or refresh user state).
 * A full rehydrate implementation (restoring the original URL, re-running the token
 * exchange, etc.) is deferred to a later task.
 */
export function resumeRedirect(): boolean {
  const raw = sessionStorage.getItem(SSO_PENDING_KEY);
  if (!raw) return false;
  sessionStorage.removeItem(SSO_PENDING_KEY);
  return true;
}
