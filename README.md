# `@boogy/web`

The browser SDK for apps built on Boogy — authenticated requests to your deployed services, user sign-in, and session management.

## Install

```bash
pnpm add @boogy/web
# or: npm install @boogy/web
# or: yarn add @boogy/web
```

ESM only. TypeScript types are bundled. Requires a browser with `fetch`, `Promise`, and `window.open`.

## Quickstart

```ts
import { Boogy } from '@boogy/web';

// Construct once at module scope — internal state lives on the instance.
const boogy = new Boogy({ host: 'https://boogy.ai' });

// One call does everything: drives sign-in and consent if needed,
// attaches the app-scoped session, and retries silently on token expiry.
const res = await boogy.fetch('alice/reddit-clone', '/api/posts');
const posts = await res.json();
```

That snippet is complete. Change `alice/reddit-clone` and `/api/posts` to your app and it works.

## Three concepts you must know

1. **App identifier.** Every API is `{owner}/{service}`, e.g. `alice/reddit-clone`. Pass only the path segment — never `https://...` or `boogy://...`.
2. **Per-app user IDs.** When your app receives an authenticated request, the user appears as a stable, app-specific ID in the `pairwiseId` field (e.g. `pw_a1b2c3...`). The same person gets a *different* ID in every app, so apps can't track a user across each other. Use it as the primary key in your own users table — you can't recover a cross-app or global identity from it, and that's by design.
3. **Cookies, not tokens you manage.** The SDK uses httpOnly cookies. You cannot read them with `document.cookie` — that is intentional (XSS protection). Use `currentUser(app)` to check session state.

## Origin context: app-origin vs dashboard-origin

The SDK is designed for **two calling contexts** with different access:

| Method | Callable from | Notes |
|---|---|---|
| `fetch` | Tenant app page | Drives sign-in + consent automatically. |
| `signIn` | Tenant app page | Explicit sign-in button (no-op if already signed in). |
| `connectApp` | Tenant app page | Pre-warm consent before first fetch. |
| `currentUser` | Tenant app page | Pure read — no popups. |
| `signOut` | Tenant app page | Per-app or global (see v1 note on `signOut({all})`). |
| `listGrants` | **Dashboard only** | Enumerates all of a user's connected apps. The endpoint lives on the auth origin but is CORS-restricted to the dashboard origin — calling from a tenant app page is blocked by the browser as `BoogyError('network')`. |
| `revokeApp` | **Dashboard only** | Revokes a specific grant. Same auth-origin endpoint + dashboard-origin CORS restriction as `listGrants`. |

A **tenant app page** is one served at `<owner>.<base>/<service>/` — the same origin as the app. A **dashboard page** is the platform's own settings UI (the CORS-allowed caller). The grant and global-logout endpoints are hosted on the auth origin (`auth.<base>`); "dashboard only" refers to the allowed *caller* origin, not the endpoint's host.

## API

One class, seven methods. Each does one thing.

### `new Boogy(options)`

```ts
const boogy = new Boogy({
  host: 'https://boogy.ai',  // required — base URL of the platform; no trailing slash
  authMode: 'popup',         // optional: 'popup' | 'redirect' — default 'popup'
});
```

| Option | Type | Default | Effect |
|---|---|---|---|
| `host` | `string` | — | Base URL of the platform. Must include scheme. |
| `authMode` | `'popup'` \| `'redirect'` | `'popup'` | How sign-in and consent flows are driven. `'popup'` keeps promises resolvable in the same page. `'redirect'` uses full-page navigation — the SDK rehydrates state on the redirect-back page load. |

Construct once at module scope and reuse. Creating a new instance per render loses the in-flight dedup state.

---

### `boogy.fetch(app, path, init?)`

Authenticated fetch against a Boogy-deployed app. Handles sign-in, consent, session attachment, and silent token refresh transparently.

```ts
// GET
const res = await boogy.fetch('alice/reddit-clone', '/api/posts');

// POST with body
const res = await boogy.fetch('alice/reddit-clone', '/api/posts', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ title: 'hello' }),
});
```

**Signature:** `fetch(app: string, path: string, init?: RequestInit): Promise<Response>`

Returns a standard `Response`. The SDK does not parse the body.

**Behavior:**
- If the user is not signed in, drives the sign-in popup (or redirect, per `authMode`).
- If this is the first call for this `app` and the user has not consented, drives the consent popup.
- On a `401` response, runs `connectApp` once and retries the original request exactly once. The retry result is returned as-is — there is no second retry.
- HTTP error responses (4xx/5xx) from the app are returned normally, not thrown. Check `res.ok` or `res.status`.
- Network / CORS failures throw `BoogyError`.

**Failure modes:**

| `e.code` | Meaning | What to do |
|---|---|---|
| `sign_in_aborted` | User closed the sign-in popup without signing in. | Show a "Please sign in to continue" UI; retry on user click. |
| `consent_denied` | User clicked Cancel on the consent prompt. | Show a "You denied access to {app}" UI; do not auto-retry. |
| `popup_blocked` | Browser blocked the popup. | Recreate with `authMode: 'redirect'` and retry, or prompt the user to allow popups. |
| `app_not_found` | The `app` argument does not resolve to a deployed service. | Verify the `{owner}/{service}` value; surface as a config error. |
| `network` | Could not reach the platform. | Standard offline handling. |

---

### `boogy.signIn()`

Ensures the user is signed in. Resolves immediately if a session is valid; otherwise drives the sign-in popup (or redirect).

```ts
await boogy.signIn();
```

**v1 note:** In the current release the bootstrap session is established lazily the first time `connectApp` or `fetch` drives the `/authorize` flow. Calling `signIn()` alone (without a subsequent `fetch` or `connectApp`) is a no-op — it resolves immediately. Use it when you want an explicit "Sign in" button on a landing page before the user navigates to an app.

**Throws:** `BoogyError` with code `sign_in_aborted` or `popup_blocked`.

---

### `boogy.connectApp(app)`

Ensures the user has consented to a specific app and holds a valid session cookie for it. Drives the consent popup if not yet consented.

```ts
await boogy.connectApp('alice/reddit-clone');
```

Use this to pre-warm the consent flow before the user reaches the first authenticated action. You do not need to call it before `fetch()` — `fetch()` calls it internally when needed.

**Throws:** `BoogyError` with code `consent_denied`, `popup_blocked`, or `app_not_found`.

---

### `boogy.currentUser(app)`

Returns the user's app-specific ID (`pairwiseId`) for an app, or `null` if the user is not connected.

```ts
const user = await boogy.currentUser('alice/reddit-clone');
if (user === null) {
  showSignInButton();
} else {
  console.log(user.pairwiseId);   // 'pw_a1b2c3...'
  console.log(user.connectedAt ?? 'unknown');  // ISO 8601, may be undefined
}
```

**Signature:** `currentUser(app: string): Promise<CurrentUser | null>`

Does not open popups or redirect. Pure read — never throws.

---

### `boogy.signOut(target)`

Signs the user out.

```ts
// Sign out of a specific app (clears that app's session cookie):
await boogy.signOut('alice/reddit-clone');

// Sign out globally (clears the bootstrap session):
await boogy.signOut({ all: true });
```

**Signature:** `signOut(target: string | { all: true }): Promise<void>`

- `signOut(app)` — POSTs `<app-origin>/boogy/logout` to clear the per-app session. Best-effort: resolves regardless of the response.
- `signOut({ all: true })` — POSTs the global logout endpoint on the auth origin to clear the bootstrap session.

**v1 note:** `signOut({ all: true })` targets the auth origin (`auth.<base>`), which is cross-origin from any tenant app page. The browser sends the POST but CORS will block the response unless the auth origin allows the calling origin. In practice the global session expires on its own. This method swallows the CORS/network error and resolves — it is explicitly best-effort. For reliable per-app sign-out, `signOut(app)` always works from the app origin.

Does not revoke the consent grant — the user is still consented and the next `connectApp()` will succeed silently. To remove consent, call `revokeApp()`.

Does not throw.

---

### `boogy.listGrants()`

Lists all apps the user has connected to.

```ts
const grants = await boogy.listGrants();
for (const g of grants) {
  console.log(`${g.app} — last used ${g.lastUsedAt ?? 'never'}`);
}
```

**Signature:** `listGrants(): Promise<Grant[]>`

**Dashboard context only.** This endpoint lives on the auth origin (`auth.<base>`) and its CORS policy allows only the dashboard origin as a caller. Calling from a tenant app page will cause the browser to block the request; the SDK surfaces this as `BoogyError('network')`. Apps integrating with the platform should not call this — it returns every app the user has connected.

**Failure modes:**

| `e.code` | Meaning |
|---|---|
| `network` | Network error, CORS block (called from wrong origin), or non-2xx response. |

---

### `boogy.revokeApp(app)`

Revokes the consent grant for an app. The next `connectApp()` or `fetch()` for this app will re-prompt for consent.

```ts
await boogy.revokeApp('alice/reddit-clone');
```

**Signature:** `revokeApp(app: string): Promise<void>`

Resolves on `2xx` or `404` (idempotent — a missing grant is treated as already revoked). App sessions in flight remain valid until their TTL expires.

**Dashboard context only.** Same CORS restriction as `listGrants`.

**Failure modes:**

| `e.code` | Meaning |
|---|---|
| `network` | Network error, CORS block, or unexpected non-2xx/non-404 response. |

---

## Errors

The SDK throws a single error type with a closed-enum `code`. Always discriminate on `code`, never on the message string.

```ts
import { BoogyError } from '@boogy/web';

try {
  await boogy.fetch('alice/reddit-clone', '/api/posts');
} catch (e) {
  if (e instanceof BoogyError) {
    switch (e.code) {
      case 'sign_in_aborted':  // user closed the sign-in popup
        break;
      case 'consent_denied':   // user clicked Cancel on consent
        break;
      case 'popup_blocked':    // recreate with authMode:'redirect'
        break;
      case 'app_not_found':    // bad {owner}/{service} — check your config
        break;
      case 'network':          // offline or CORS
        break;
    }
  } else {
    throw e;
  }
}
```

---

## Recipes

### Sign-in button

```ts
const button = document.querySelector('#sign-in');
button.addEventListener('click', async () => {
  try {
    await boogy.signIn();
    location.reload();
  } catch (e) {
    if (e.code !== 'sign_in_aborted') throw e;
    // user dismissed — do nothing
  }
});
```

### Check session state on page load

```ts
const user = await boogy.currentUser('alice/reddit-clone');
if (user === null) {
  showSignInButton();
} else {
  showApp(user.pairwiseId);
}
```

### Make an authenticated request and handle app errors

```ts
const res = await boogy.fetch('alice/reddit-clone', '/api/posts/123', {
  method: 'DELETE',
});

if (res.status === 404) {
  showError('Post not found.');
} else if (res.status === 403) {
  showError('You do not own this post.');
} else if (!res.ok) {
  showError(`Unexpected error: ${res.status}`);
} else {
  removePostFromUI(123);
}
```

### Global sign-out

```ts
await boogy.signOut({ all: true });
location.href = '/';
```

### Revoke an app from a settings UI

```ts
async function renderGrants() {
  const grants = await boogy.listGrants();
  for (const g of grants) {
    const row = document.createElement('div');
    row.textContent = `${g.app} — last used ${g.lastUsedAt ?? 'never'}`;
    const btn = document.createElement('button');
    btn.textContent = 'Revoke';
    btn.onclick = async () => {
      await boogy.revokeApp(g.app);
      renderGrants();
    };
    row.appendChild(btn);
    document.body.appendChild(row);
  }
}
```

---

## Pitfalls

**Don't pass `boogy://...` to `fetch()`.** The `app` argument is `{owner}/{service}` only.

```ts
// Wrong:
await boogy.fetch('boogy://alice/services/reddit-clone', '/api/posts');
// Right:
await boogy.fetch('alice/reddit-clone', '/api/posts');
```

**Don't read cookies to check sign-in state.** Session cookies are httpOnly — `document.cookie` will not see them.

```ts
// Wrong:
if (document.cookie.includes('boogy_bootstrap')) { ... }
// Right:
const user = await boogy.currentUser('alice/reddit-clone');
if (user !== null) { ... }
```

**Don't manage tokens.** The SDK handles refresh internally. Do not read or write `Authorization` headers manually.

```ts
// Wrong:
const token = await boogy.fetch(...).then(r => r.headers.get('x-token'));
fetch('/alice/reddit-clone/api/posts', { headers: { Authorization: `Bearer ${token}` } });
// Right:
await boogy.fetch('alice/reddit-clone', '/api/posts');
```

**Don't try to look up a global identity from `pairwiseId`.** Each user gets a different `pairwiseId` in every app — the mapping is intentionally one-way. The SDK does not expose a global identity lookup.

**Don't call `signIn()` or `connectApp()` outside a user-initiated handler.** Both may open popups. Popups opened outside a user gesture (click, key press) are blocked by browsers.

```ts
// Wrong:
useEffect(() => { boogy.signIn(); }, []);
// Right:
<button onClick={() => boogy.signIn()}>Sign in</button>
```

**Don't catch errors generically.** `BoogyError` carries actionable codes; collapsing them to a single message loses information needed to react correctly.

```ts
// Wrong:
try { await boogy.fetch(...) } catch (e) { alert('Error: ' + e.message) }
// Right: discriminate on e.code as shown in the Errors section above.
```

**Don't call `listGrants()` from an app page.** It enumerates every app the user has connected — apps should never read that. It is for the platform's own settings UI, and calling it from a tenant app page will fail with `BoogyError('network')` due to CORS.

**Don't re-instantiate `Boogy` on every render.** Internal dedup state lives on the instance — construct once at module scope or in a context provider.

```ts
// Wrong (new instance on every render):
function App() {
  const boogy = new Boogy({ host: '...' });
  ...
}
// Right:
const boogy = new Boogy({ host: '...' });
function App() { ... }
```

---

## TypeScript types

Complete definitions for the public surface:

```ts
export interface BoogyOptions {
  host: string;
  authMode?: 'popup' | 'redirect';
}

export interface CurrentUser {
  pairwiseId: string;
  connectedAt?: string;  // ISO 8601 — omitted if the grant record is unavailable
}

export interface Grant {
  app: string;
  connectedAt: string;   // ISO 8601
  lastUsedAt?: string;   // ISO 8601 — absent until first use
}

export class BoogyError extends Error {
  readonly code:
    | 'sign_in_aborted'
    | 'consent_denied'
    | 'popup_blocked'
    | 'app_not_found'
    | 'network';
  readonly app?: string;   // populated for app-scoped errors
}

export class Boogy {
  constructor(options: BoogyOptions);

  fetch(app: string, path: string, init?: RequestInit): Promise<Response>;
  signIn(): Promise<void>;
  connectApp(app: string): Promise<void>;
  currentUser(app: string): Promise<CurrentUser | null>;
  signOut(target: string | { all: true }): Promise<void>;
  revokeApp(app: string): Promise<void>;
  listGrants(): Promise<Grant[]>;
}
```
