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

- `signOut(app)` — POSTs `<app-origin>/boogy/logout?service=<service>` to clear THAT app's session and no other. Best-effort: resolves regardless of the response. The `service` parameter is what makes it per-app: the cookie is named per service and one tenant origin serves all of an owner's services, so an unnamed logout clears every sibling app's session too.
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

## Panes: when your app is shown inside a board

A board shows several apps side by side, each in its own frame. By default a
board knows nothing about the app inside a frame: it shows the name the pane was
given, and opens the app at its home page every time. An app can tell the board
three things, so the board can do better:

- **its title**, shown in the frame's header instead of the address;
- **where it is**, so reopening the board brings the app back to that page;
- **whether someone is signed in to it.**

```ts
import { connectPane } from '@boogy/web';

const pane = connectPane({ service: 'notes' });

pane.reportTitle('Meeting notes');
pane.reportLocation('/notes/42');   // a path on your own address
pane.reportAuthState(true);
```

**Moving between pages inside your app: use `pane.navigate`.** In a board, a
page that adds browser history adds it to the *board's* history too, so the
browser's back button would step through your app instead of leaving the
board. `pane.navigate(path)` changes the address without adding browser
history, keeps your app's own history, and lets the board show back and
forward buttons for your pane. Outside a board it is an ordinary
`history.pushState`.

```ts
const pane = connectPane({
  service: 'notes',
  // The board moved your pane back or forward: the address already shows
  // `path`, so render it.
  onNavigate: (path) => render(path),
});

pane.navigate('/notes/42');   // instead of history.pushState(…)
pane.navigate('/', { reset: true });   // after sign-out: back must not lead into the old session
```

A pane reports its whole history (at most 50 pages) to the board, so when the
board moves your app to another frame it can hand the history back; your app
takes it only if it is on that history's current page. You do nothing for
this: it is part of `connectPane`.

The board offers back and forward only for an app that passes `onNavigate`,
since only such an app can render a step the board asks for. Any framed app
calling `navigate` still stays out of the board's browser history.

Call `connectPane` once and report whenever something changes. It does not
matter when: a board connects when the frame loads, and if your app starts
listening later, it says hello to the board and the board connects then. Reports
made before a board connects are sent when it does.

**Your app works exactly as before when it is not in a board**, or when it
never calls `connectPane`: every report is then a no-op, and a board falls back
to its defaults.

**Which boards may talk to your app is decided by the platform, not guessed.**
Your app reads the list from `GET /boogy/config` on its own origin and answers
only those boards. Nothing is inferred from `document.referrer` or the parent
window.

**A location must be a path under your app's own address** (for an app at
`/notes`, something like `/notes/42`). A board ignores anything else, including
full URLs, so a report can never send the board somewhere else.

**What a board learns, and what it does not.** A report is a request, and a
board may ignore it. No credential crosses the channel: the session cookie is
not readable by script on any origin, and `reportAuthState` carries a yes or
no, never an id or a name.

**One limit to know about.** All of one account's apps are served from the
same origin, and the browser identifies a message's sender by origin. A board
therefore knows which *frame* a message came from, but an app could send
messages that appear to come from another app of the same account. Treat a
report as coming from the account's apps, not from one app in particular.

### Sizing with the frame

A frame can be any size, from a narrow column to most of the screen. To have
your whole page follow it, pass `scale` once where you install the SDK's styles:

```ts
import { installFoundation } from '@boogy/web';

installFoundation({ scale: true });
```

The page's size unit then follows the frame's shorter side, between a floor and
a cap (10px to 17px by default; 17px is reached once the shorter side is
about 425px wide). Every component, every size token (`--space-*`, `--fs-*`,
`--control-*`, …) and the page's plain text derive from that one unit, so they
scale together and nothing else needs a setting. Size your own styles from the
same tokens, not from `px` or `rem`, and they follow too. To change the range,
pass the fields you want instead of `true`, for example
`installFoundation({ scale: { cap: '1.25rem' } })`.

It is off by default: without it the page keeps a fixed base size, which suits
an app that fills a browser window of its own.

### Zoom

A person can make your whole interface larger or smaller. `--u-zoom` multiplies
the same size unit, so every component, size token and line of plain text grows
or shrinks together. Hairlines, shadows and images keep their shape. This is
not browser zoom.

```tsx
import { ZoomControls, useZoom } from '@boogy/web/preact';

<ZoomControls />          // a Smaller / Larger pair
const { zoom } = useZoom(); // the number, for code that needs it (a canvas, say)
```

`<ZoomControls />` steps the page's own zoom along `ZOOM_STEPS` (0.8 to 2). The
value is remembered in this browser under your app's mount; `rememberZoom(key)`
changes where. Pass `value` and `onValueChange` to step a value of your own
instead. In a board, the page is drawn at the board's zoom times its own (see
the shell's `setZoom` below).

### Building a board

```ts
import { createShell } from '@boogy/web';

const shell = createShell({
  onReady: (id, service) => { /* the app speaks the protocol */ },
  onTitle: (id, text) => { /* show text in the frame header */ },
  onLocation: (id, path) => { /* save path; open the frame there next time */ },
  onAuthState: (id, signedIn) => { /* show the app's signed-in state */ },
  onHistoryState: (id, canBack, canForward, history) => {
    /* enable the frame's back and forward buttons; keep `history` with the
       pane's content and pass it as `history` when registering the frame the
       content moves to */
  },
});

// The frame's back and forward buttons:
shell.back('pane-1');
shell.forward('pane-1');

shell.registerPane(iframe, {
  id: 'pane-1',
  service: 'notes',
  origin: 'https://alice.boogy.app',
  mount: '/notes',
});
```

Register a frame once; the board reconnects it every time the frame loads.
Titles are trimmed, stripped of control and text-direction characters, and
capped at `MAX_TITLE_LENGTH` characters; a location outside the frame's own
`mount`, or longer than 2048 characters, is never reported.

**Zoom.** A board can set the size its panes are drawn at:

```ts
shell.setZoom(1.25);              // every pane
shell.setPaneZoom('pane-1', 1.5); // this pane, outranking the board's
shell.setPaneZoom('pane-1', null); // this pane follows the board again
```

A pane applies it through `connectPane`, with no code of its own, multiplied by
the app's own zoom (see [Zoom](#zoom)). A pane that is reloaded, or registered
again, keeps its size. Factors are clamped to 0.5–3.

### Versioning

Every message carries `boogy: 'pane/v1'` (`PANE_PROTOCOL`). New messages may be
added within `v1`; a change that would break an existing app is `pane/v2`, and
a board speaks both while apps move over.

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
