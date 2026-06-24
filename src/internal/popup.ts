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
  return new Promise<void>((resolve, reject) => {
    const popup = window.open(authorizeUrl, 'boogy_sso', 'popup,width=480,height=640');

    if (!popup) {
      reject(new BoogyError('popup_blocked', 'The sign-in popup was blocked by the browser.'));
      return;
    }

    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(closedPoll);
      // Best-effort: close the popup if it is still open (e.g. user closed it manually
      // before the callback ran, and we detected it via the poll).
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
      // Strictly check the origin — ignore any message not from the expected app origin.
      if (event.origin !== appOrigin) return;

      const boogy = (event.data as { boogy?: string } | null)?.boogy;
      if (boogy === 'sso_done') {
        settle(() => resolve());
      } else if (boogy === 'sso_cancelled') {
        settle(() => reject(new BoogyError('consent_denied', 'The user cancelled the sign-in.')));
      }
      // Any other `boogy` value (or unrecognised message) is ignored.
    };

    window.addEventListener('message', onMessage);

    // Poll for popup closure. If it closes before we received an SSO message, the user
    // dismissed the window without completing the flow.
    const closedPoll = setInterval(() => {
      if (popup.closed) {
        settle(() =>
          reject(new BoogyError('sign_in_aborted', 'The sign-in popup was closed before completion.')),
        );
      }
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
