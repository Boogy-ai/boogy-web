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

A **tenant app page** is one served from the app's own origin — the same origin the SDK's calls above resolve to, below. A **dashboard page** is the platform's own settings UI (the CORS-allowed caller). The grant and global-logout endpoints are hosted on the auth origin (`auth.<base>`); "dashboard only" refers to the allowed *caller* origin, not the endpoint's host.

### Your app's own address

**Every deployed app is served at an address of its own, not a shared one**:
its label, `https://<label>.<base>` — such as `https://notes-k3v9.boogy.app`,
the `URL:` that `boogy deploy` prints. Your page, its assets and its API all
share that origin, at its root. You do not construct the address yourself —
the SDK reads what it needs from the platform, as below.

- **`boogy.fetch(app, path)` addresses your app's root on its own address.**
  Calling it with your OWN `{owner}/{service}` resolves `path` against the
  origin your page is already running on — so `boogy.fetch('alice/notes',
  '/api/posts')`, called from `alice/notes`'s own page, is the same request as
  a plain `fetch('/api/posts')`. The library resolves this from the platform
  config it already loaded, never from `location.hostname` — don't parse your
  own address to build a URL the SDK already knows how to build.
- **Own backend only.** Another app is at an address of its own, which the
  platform allocates and your page cannot work out, so `boogy.fetch`,
  `currentUser` and `signOut` naming a DIFFERENT `{owner}/{service}` reject
  with `app_not_found` rather than send the request to your own app. Reach
  another of your services by having your OWN backend call it over the mesh,
  server-side, or call it at its address with an app token (see
  [App tokens](#app-tokens-signing-in-from-another-website)).

### One app session per origin, for one app

**A sign-in covers exactly one app.** Every origin that holds an app session
serves exactly one app — your app's own origin, a custom domain, the boards
origin — so its one session cookie names that one app and no other. A new
sign-in on the origin replaces the session rather than adding to it.

- **Shown alone at its own address — or on a custom domain bound to it —
  your app signs in by the platform's sign-in**: `signIn()` and `connectApp()`
  send the page to that origin's own `/boogy/signin`, which brings the person
  back to where they were. Such an origin serves your one app, and
  `loadPlatformConfig()`'s `service` says which.
- **In a board, your app is signed in by the board**, through a background
  exchange that never navigates to your app's address (`startExchangeSignIn`
  starts that trip, on the boards origin). Your app asks for it with
  `pane.requestSignIn()` (see [Signing in from a pane](#signing-in-from-a-pane));
  `connectApp` and `signIn` do the same there.
- The same app, open alone in one tab and in a board in another, is one
  origin with one session: signing in or out in either holds for both.

**Changed in this release (no compatibility layer):**

- `connectApp(app)` takes exactly one `owner/service` — the batch form
  `connectApp([...])` is gone, and so is the `renewAudiences` constructor
  option: a renewal re-authorizes the one app whose request failed.
- `siteSignInUrl` and `siteSignOutUrl` are gone; a board signs apps in with
  `startExchangeSignIn` and signs each one out at its own address.
- Every app is served at its own address. Shown alone there, `signIn()` and
  `connectApp()` go to its `/boogy/signin` (they used to refuse with
  `sign_in_unavailable`), and `boogy.fetch` addresses the origin's root, never
  a path named after the service.
- `loadPlatformConfig()` no longer reports `appOriginTemplate` or `address`, <!-- owner-subdomain-ok: names the retired config field so an upgrader can find it -->
  and `pane.host` / `createShell`'s `host` are `'board'` only: no page frames
  an app alone any more.
- `startExchangeSignIn` takes no `owner`: each app's label names its own.
- The install page asks for a name only; `mountPathProblem` and `TakenApp` are
  gone.
- `CurrentUser.services` is gone: a session covers one app, so there is no set
  to report.
- `signOut(app)` POSTs `<app-origin>/boogy/logout`, which clears the origin's
  one session and answers `204`.

## API

One class, seven methods. Each does one thing.

### `new Boogy(options)`

```ts
const boogy = new Boogy({
  host: 'https://boogy.ai',  // required — base URL of the platform; no trailing slash
  authMode: 'popup',         // optional: 'popup' | 'redirect' — how `install` runs; default 'popup'
});
```

| Option | Type | Default | Effect |
|---|---|---|---|
| `host` | `string` | — | Base URL of the platform. Must include scheme. |
| `authMode` | `'popup'` \| `'redirect'` | `'popup'` | How the install flow runs. `'popup'` keeps the promise resolvable in the same page. `'redirect'` uses full-page navigation, and the result is read on the page the person comes back to. Sign-in does not read it: the platform makes every sign-in. |

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
- If the user is not signed in, the platform makes the sign-in: on your app's own address the page goes to its `/boogy/signin`, and in a frame the page framing it is asked.
- If this is the first call for this `app` and the user has not consented, drives the consent popup.
- On a `401` response, runs `connectApp` once and retries the original request exactly once. The retry result is returned as-is — there is no second retry.
- HTTP error responses (4xx/5xx) from the app are returned normally, not thrown. Check `res.ok` or `res.status`.
- Network / CORS failures throw `BoogyError`.

**Failure modes:**

| `e.code` | Meaning | What to do |
|---|---|---|
| `sign_in_aborted` | User closed the sign-in popup without signing in. | Show a "Please sign in to continue" UI; retry on user click. |
| `consent_denied` | User clicked Cancel on the consent prompt. | Show a "You denied access to {app}" UI; do not auto-retry. |
| `popup_blocked` | Browser blocked the install popup. | Recreate with `authMode: 'redirect'` and retry, or prompt the user to allow popups. |
| `app_not_found` | The `app` argument names an app not served at this page's origin. | Verify the `{owner}/{service}` value; another app is reached through your backend, or with an app token. |
| `url_not_allowed` | `path` does not start with exactly one `/`, so joined onto the app's address it could name another host or port. Nothing was sent. | Pass a path on the app's own address, such as `/api/posts`. |
| `network` | Could not reach the platform. | Standard offline handling. |
| `sign_in_unavailable` | Sign-in is the platform's to make: in a frame, the framing page's, and none is connected or answered; on an origin that names no service, there is none to make. | Tell the person to open the app at its own address. |
| `sign_in_busy` | In a frame, a sign-in for this app went moments ago. | Ask again in a few seconds; the message says how many. |

---

### `boogy.signIn()`

Ensures the user is signed in. Resolves immediately if a session is valid; otherwise the platform signs the person in (see below).

```ts
await boogy.signIn();
```

**v1 note:** In the current release the bootstrap session is established lazily the first time `connectApp` or `fetch` drives the `/authorize` flow. Calling `signIn()` alone (without a subsequent `fetch` or `connectApp`) is a no-op — it resolves immediately. Use it when you want an explicit "Sign in" button on a landing page before the user navigates to an app.

**On your app's own address, or in a frame,** it first asks your app's own origin whether it holds a session (`/boogy/me`), and resolves at once if it does — so calling it on every load costs one request, never a sign-in trip. Signed out and shown alone, it sends the page to the address's own `/boogy/signin`, which brings the person back to where they were (it never settles: the page is leaving). Signed out in a frame, it tells the page framing your app so and asks it to sign your app in, exactly as `pane.requestSignIn()` does (see [Signing in from a pane](#signing-in-from-a-pane)), resolving once that page is leaving for sign-in.

**Throws:** in a frame, `sign_in_busy` when a sign-in went moments ago, and `sign_in_unavailable` when no page framing it is connected or answers.

---

### `boogy.connectApp(app)`

Ensures the user has consented to ONE specific app and holds a valid session cookie for it; the platform makes the sign-in and any consent. It names exactly one `owner/service`: an app session covers one app (see [One app session per origin, for one app](#one-app-session-per-origin-for-one-app)).

```ts
await boogy.connectApp('alice/reddit-clone');
```

Use this to pre-warm the consent flow before the user reaches the first authenticated action. You do not need to call it before `fetch()` — `fetch()` calls it internally when needed.

**On your app's own address, shown alone,** the platform runs the sign-in: if the address already holds a session it resolves at once, and otherwise the page goes to the address's own `/boogy/signin` — a redirect — and comes back to where the person was. An address serves one app, so `app` must be yours there; another rejects with `app_not_found`.

**In a frame,** it starts no sign-in of its own: the sign-in page refuses to be framed. If your app's own origin already holds a session it resolves at once. Otherwise it tells the page framing your app that it is signed out and asks it to make the trip, exactly as `pane.requestSignIn()` does, resolving once that page is leaving for sign-in (it comes back to where the person was). It rejects with `sign_in_busy` when a sign-in went moments ago, and with `sign_in_unavailable` when no such page is connected or answers; either way it navigates nowhere.

On an origin that names no service — one the platform gives no app of its own — there is no sign-in to make: it rejects with `sign_in_unavailable` and navigates nowhere. Sign in at the app's own address, or with an app token.

**Throws:** `BoogyError` with code `app_not_found`, `sign_in_busy`, or `sign_in_unavailable`.

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

- `signOut(app)` — POSTs `<app-origin>/boogy/logout` to clear the app's session: the origin's one session, which covers that one app. Best-effort: resolves regardless of the response.
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

## App tokens: signing in from another website

Everything above signs a person in to **your own app at its own address**,
where the session lives in an httpOnly cookie. A website on another origin
cannot use that cookie, so it signs the person in to your service itself and
calls it with `Authorization: Bearer <app token>`. Any service may admit such
websites, with a frontend of its own or without; the websites it lists are its
opt-in:

```ts
import { BoogyError, appTokenSession, completeAppToken, requestAppToken } from '@boogy/web';

const SERVICE = 'alice/notes-api';

// Leaves for the sign-in, and comes back to `redirect`.
const signIn = () =>
  requestAppToken({
    service: SERVICE,
    redirect: 'https://app.example.com/signed-in', // registered by the service, exactly
    authOrigin: 'https://auth.boogy.ai',
  });

// On the page the person comes back to (run it on every load): finish the
// sign-in this URL carries, if any. It keeps the session for you.
try {
  await completeAppToken(); // null when this URL carries no sign-in
} catch (e) {
  // `consent_denied`, or a sign-in that cannot be finished: offer to try again.
  if (!(e instanceof BoogyError)) throw e;
  console.warn(`sign-in did not finish: ${e.code}`);
}

// The person's sign-in to the service, on this website, in every tab.
// `fetch` sends your access token to the URL you give it: `apiOrigin` makes it
// refuse any URL that is not on your service's origin.
const notes = appTokenSession(SERVICE, { apiOrigin: 'https://notes-api-k3v9.boogy.app' });

async function loadNotes() {
  if (!notes.signedIn()) return signIn();
  try {
    // Sends `Authorization: Bearer …`, renewing the token first when it must.
    const res = await notes.fetch('https://notes-api-k3v9.boogy.app/notes');
    return await res.json();
  } catch (e) {
    if (!(e instanceof BoogyError)) throw e;
    // The platform ended the sign-in: the session is already forgotten.
    if (e.code === 'sign_in_required') return signIn();
    // `network`: the platform could not be reached. The person is still
    // signed in; show that the service is unreachable and let them retry.
    throw e;
  }
}

// A "Sign out" button: revokes the sign-in and forgets it, in every tab.
document.querySelector('#sign-out')?.addEventListener('click', () => notes.signOut());
```

**What the service has to allow.** The platform hands a page a token only for a
service that already lets that page call it, and returns the sign-in only to a
URL the service named. In the service's `boogy.toml`:

```toml
[ingress.cors]
allowed_origins = ["https://app.example.com"]        # this page's origin, by name
allowed_headers = ["authorization", "content-type"]  # the headers the page sends

[ingress.app_tokens]
redirect_uris = ["https://app.example.com/signed-in"]  # where a sign-in may come back to
```

- The page's origin must be listed **by name**. `allowed_origins = ["*"]` lets
  any page *call* a public API, and lets no page obtain a person's token.
- `redirect_uris` lists the **exact** URLs a sign-in may come back to (at most
  20). The one-time code rides back in the URL, so only those pages can receive
  it: `requestAppToken`'s `redirect` must equal one of them byte for byte — no
  extra query, no other path, no other spelling. Each must be an absolute
  `https://` URL (`http://` only for `localhost`), with no `#fragment`, written
  the way a URL parser prints it (`https://app.example.com/`, not
  `https://app.example.com`), on an origin `allowed_origins` names. A service
  that lists none signs nobody in.
- A service with a `[frontend]` admits app tokens as well: its own pages keep
  the cookie flow above, and the websites it lists get tokens.
- The browser sends a preflight before the Bearer call, and the platform
  answers it from `[ingress.cors]` (you do not route `OPTIONS` yourself). It
  admits only the request headers `allowed_headers` lists: without
  `"authorization"` there, the preflight fails and the request never leaves the
  page.

**`requestAppToken({ service, redirect, authOrigin? })`** — keeps a PKCE
verifier and a `state` in this tab's `sessionStorage` and sends the person to
sign in. `service` is `owner/service`. `redirect` is where they come back to:
one of the service's `redirect_uris`, absolute and on this page's origin, sent
exactly as written. `authOrigin`
is where sign-in is served; it defaults to the platform config a page the
platform serves has loaded, and is required anywhere else. The person sees a
consent screen naming the service and this page, unless they own the service
and this page is at one of their services' own addresses, or on a custom
domain bound to one of their services. Consent is per page: once allowed, later trips from this
page are silent, but a different page on the service's allowlist is asked
again. A person who disconnected the service — its owner included — is asked
again too.

**`completeAppToken()`** — on the page the person returns to: removes the
sign-in from the address bar and history, checks it is the one this tab
started, then exchanges it for an access token and a refresh token. It keeps
both as the person's session for the service (see **Staying signed in**) and
resolves with the access token alone. If your website already held a sign-in
to the same service, that one is signed out at the platform in the background,
with the token it holds now, so a second sign-in never leaves the first one
live. Resolves `null` when the URL carries no sign-in, otherwise:

| Field | Meaning |
|---|---|
| `accessToken` | Send as `Authorization: Bearer …` to the one service it names, and nowhere else. It is encrypted: an opaque string from which this page can read nothing about the person. |
| `tokenType` | `'Bearer'`. |
| `expiresIn` / `expiresAt` | Seconds it was valid for when issued (15 minutes by default) / epoch milliseconds it expires. |
| `service` | The `owner/service` it is for. |

You rarely need this object: `appTokenSession(service)` hands out a live
token whenever you ask. Do not store a token yourself, in `localStorage`, a
cookie, or a URL.

### Staying signed in

The access token lasts 15 minutes. `appTokenSession(service, options?)` renews
it with the refresh token before it runs out, so the person signs in once and
stays signed in while they keep using your page, across reloads and tabs. The
API never hands the refresh token to your code, though your page's storage
holds it (see below).

`options.apiOrigin` is your service's own address, such as `https://notes-api-k3v9.boogy.app`:
`https://`, or `http://` only on loopback (`localhost`, `*.localhost`,
`127.0.0.1` or `[::1]`). When it is set, `fetch` refuses any URL on another
origin with `url_not_allowed` and sends nothing. Relative URLs are refused too,
since they resolve against your page's origin, not the service's: pass absolute
URLs.

| Member | |
|---|---|
| `accessToken()` | A live access token. With 60 seconds or less left (`REFRESH_SKEW_MS`), it is renewed first. Rejects with `sign_in_required` or `network`. |
| `fetch(input, init?)` | `fetch` with `Authorization: Bearer <access token>`, and no cookies unless `init.credentials` asks for them. **`fetch` sends your access token to the URL you give it. Pass only your service's URLs, or set `apiOrigin`.** On a `401` from the service it renews once and retries once, and a second `401` is returned to you. A `401` to a token that such a forced renewal issued is returned as it is, so a route that always answers `401` cannot keep rotating the sign-in. |
| `signOut()` | Revokes the sign-in at the platform and forgets it, in every tab. It forgets it even when the platform cannot be reached. If the platform cannot be reached, the SDK keeps retrying the revoke on later visits; until it lands, a copy taken earlier still works. |
| `signedIn()` | Whether a sign-in is held. Makes no request. |
| `service` | The `owner/service` it is for. |

Expiry is counted from when the token arrived, by this device's own clock, so a
device whose clock is wrong still renews on time.

**Each renewal retires the refresh token it sends**, and the platform answers
with a new one. A retired token presented again looks like theft to the
platform, which then ends the sign-in everywhere (a lost answer retried within
a minute is the one exception, below). So the SDK never lets two
renewals send the same token: the callers in one tab share one renewal, and in
every tab renewing and signing out wait on the same `navigator.locks` lock and
re-read the stored session first. A tab that waited uses the token the other
tab just received.

**When the person must sign in again.** `accessToken()` and `fetch()` reject
with `sign_in_required`, and the session is already forgotten. Call
`requestAppToken` again; while the person still allows your page, the trip is
silent: they go to the platform and come straight back. It happens only after:

- **30 days without use.** The refresh token lapses 30 days after its last
  renewal, and each renewal restarts that count.
- **90 days after signing in.** However often it is renewed, a sign-in ends
  90 days after it started (both are the platform's defaults). Near the end,
  each renewal is told how much of the 90 days is left, and the SDK sends
  nothing after it.
- **A revoke.** The person signed out (in any tab), or disconnected the service
  from their Boogy account, or the service no longer allows your website, or
  their account was suspended.
- **Too many sign-ins.** One person keeps at most 20 sign-ins to one service
  from your website (one per browser, roughly). A 21st signs out the one used
  least recently.
- **Too many renewals.** To recognise a retired token presented again, the
  platform keeps a hash of every refresh token a sign-in has issued until
  that token would have expired (30 days after it was issued), and it keeps
  at most 10,000 for one sign-in. A renewal that would make it more ends the sign-in.
  A page renewing every 14 minutes holds about 3,100 at a time, over the
  whole 90 days.
- **Theft detection.** A retired refresh token was presented again, while it
  would still have been alive. A renewal whose answer was lost on the way back
  is not counted as that for one minute (below); past that minute, or once its
  replacement has been used, the platform cannot tell it from theft, and the
  sign-in ends.

**When the platform cannot be reached**, they reject with `network`, and the
person is still signed in. A renewal the platform could not decide (offline, a
`503`, a rate limit, no answer within 10 seconds, or a failure the browser
hides from the page) does not sign anyone out. The SDK waits before trying again: 1 second, doubling with each
failure in a row up to 60 seconds, or longer when the platform's `Retry-After`
is readable and asks for it. Every tab shares that wait. Meanwhile, an access
token that has not expired is still handed out. Tell the person the service is
unreachable and let them retry; do not send them to sign in.

**A lost answer, and the one-minute grace.** A renewal can fail after the
platform has already rotated: its answer lost on the way back, or a `503` for a
write that did in fact land. The SDK cannot tell, so it keeps the token it
holds and sends it again. For one minute after the rotation, while the
replacement has not been used, the platform answers that retry with the same
replacement, and nothing is lost. That minute is why every request to the
platform's token endpoints gives up after 10 seconds. In the worst case the
platform rotates as soon as the first request arrives and every attempt then
hangs for its full 10 seconds; with the waits of 1, 2, 4 and 8 seconds between
them, the retries go out 11, 23, 37 and 55 seconds after the first request:
four inside the minute. At 30 seconds only one would fit. What the grace does
**not** cover: a retry that reaches the platform more than a minute after the
rotation. The SDK retries only when your page next asks for a token, so a page
that stops asking, or a device that stays offline past the minute, can retry
too late; the platform then reads the retry as theft and the sign-in ends.

**Where the session is kept, and what that costs.** The session, both tokens,
is kept in your website's `localStorage`, under
`boogy.app-token.session.v1:<owner>/<service>`. That is what keeps a new tab or
a reload signed in. A cookie your page cannot read is not available here,
because the service and the platform are on other sites. The cost is that any
script running on your website can read `localStorage`: a cross-site scripting
bug, or a compromised third-party script, can copy the refresh token. What
limits the damage:

- **Rotation with reuse detection.** If the thief and the person both renew,
  whichever presents the retired token second, while that token would still
  have been alive, ends the sign-in for both, and the platform writes a
  critical entry to its audit log. Inside the one-minute grace the platform
  cannot tell a thief from a lost answer: anyone presenting the just-retired
  token gets the same replacement, whether the two requests overlap or come
  one after the other. That sharing carries on through later renewals for as
  long as each retired token is presented within a minute of its rotation and
  before its replacement is used. The first presentation that comes later ends
  the sign-in, and nothing outlives the sign-in's 90 days.
- **Origin binding.** The platform accepts the token only from your website's
  origin, which stops another website using it. A program that forges that
  header is stopped by rotation alone.
- **Idle expiry, and a fixed end.** It lapses after 30 days unused. A thief who
  keeps renewing keeps it alive, though: they are stopped when the person
  comes back (whose next renewal presents a token the thief retired) or the
  sign-in is revoked. A script that copies the refresh token **and deletes
  your page's copy** leaves the person nothing to come back with: no retired
  token is ever presented, so reuse detection never fires. The person signs
  in again, and the copied sign-in lives on beside the new one. Only its
  90-day end bounds that, unless the person disconnects the service.
- **Revocation.** Signing out ends the sign-in your page holds. Disconnecting
  the service from their Boogy account ends every sign-in to it, a copied one
  included.

The access token is short-lived and works for one service only. Keep scripts
you do not control off pages that hold a session, and set a Content Security
Policy.

**When storage is unavailable.** Where the browser refuses `localStorage`
(blocked storage, some private modes, or storage that fills up mid-session),
the session is kept in the tab's memory: the person stays signed in in that
tab, and a new tab or a reload signs in again. A tab that cannot write a
renewed token removes the shared copy rather than leave a retired one for
another tab to present. The same holds where the browser has no `navigator.locks`, including any
page served over plain `http://` from anywhere but loopback: without the lock, two tabs
could renew at the same moment and end the sign-in, so the session is not
shared between tabs at all.

**Failure modes:**

| `e.code` | Meaning |
|---|---|
| `consent_denied` | The person cancelled on the consent screen. |
| `sign_in_aborted` | The sign-in is not one this tab started, or the platform refused it (expired, already used, or the service no longer allows this page). Start again. |
| `sign_in_required` | From `appTokenSession`: the platform ended the sign-in, or none is held. The session is already forgotten. Call `requestAppToken`. |
| `network` | The token request could not be sent, or the platform could not decide a renewal. The session is kept; try again later. |
| `url_not_allowed` | `fetch` was given a URL outside the session's `apiOrigin`. Nothing was sent. |
| `app_not_found` | `service` is not `owner/service`. |
| `config_unavailable` | No `authOrigin` was given and this page has no platform config, or `authOrigin` or `apiOrigin` is not a bare `https://` origin (`http://` only on loopback: `localhost`, `*.localhost`, `127.0.0.1` or `[::1]`). |
| `sign_in_unavailable` | `redirect` is not an absolute URL on this page's origin without a fragment, or this browser keeps no `sessionStorage` — either way a sign-in cannot be finished here. |

---

## Panes: when your app is shown inside a board

A board shows several apps side by side, each in its own frame. By default a
board knows nothing about the app inside a frame: it shows the name the pane was
given, and opens the app at its home page every time. An app can tell the board
three things, so the board can do better:

- **its title**, shown in the frame's header instead of the address;
- **where it is**, so reopening the board brings the app back to that page;
- **whether someone is signed in to it.**

**Title and location are already reported automatically, with no code of
yours.** Every app runs on an origin of its own (see below), and the platform
injects a small reporting script into every page it serves there — it reads
your app's title and address on every change and sends them, which is why a
board already shows a sensible title and reopens a bookmarked app at the right
page even for an app that calls none of this SDK. Call `connectPane` when you
want more than that: an explicit sign-in state, `pane.navigate` for
board-aware history, or to report a title/location of your own choosing rather
than whatever the automatic reporter reads off the page. Calling it **joins**
that same connection rather than opening a second one — a page talks to its
board through exactly one pane, whichever reports first.

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

**A location must be a path on your app's own address** (something like
`/notes/42`). A board ignores anything else, including full URLs, so a report
can never send the board somewhere else.

**What a board learns, and what it does not.** A report is a request, and a
board may ignore it. No credential crosses the channel: the session cookie is
not readable by script on any origin, and `reportAuthState` carries a yes or
no, never an id or a name.

**Each app runs on an origin of its own.** One account's apps are never
served from a shared origin: every deployed app gets its own address, so the
browser's own same-origin rules keep one app from
scripting, reading the storage of, or acting as you in another. The board
tells a pane's origin to the service it is bound to, and a pane's `ready`
report is checked against that binding — an app can no longer send a message
that appears to come from a *different* app, of the same account or
otherwise.

### Signing in from a pane

In a frame your app never signs itself in. The board framing it does. Report
that nobody is signed in, then ask it when the person chooses to sign in:

```ts
const pane = connectPane({
  service: 'notes',
  // A page framing your app connected, saying where your app is shown, and
  // how its last sign-in for your app ended when that did not sign it in.
  onConnect: ({ host, lastSignIn }) => renderSignIn(host, lastSignIn),
});

pane.reportAuthState(false);

signInButton.onclick = async () => {
  const answer = await pane.requestSignIn();
  if (typeof answer === 'object') showMessage(`Try again in ${Math.ceil(answer.busy / 1000)} seconds.`);
  else if (answer === 'unavailable') showMessage('Sign-in is not available here.');
  else if (answer === 'already_signed_in') recheckSession();
  // 'leaving': the page is on its way to sign-in, and comes back here.
};
```

- **`pane.requestSignIn()`** asks the page framing your app, and resolves with
  its answer:
  - `'leaving'` — it is leaving for sign-in now, and comes back to where the
    person was;
  - `'already_signed_in'` — your app's last report said someone is signed in,
    so nothing was started;
  - `{ busy: ms }` — a sign-in for your app went moments ago; ask again after
    `ms`;
  - `'unavailable'` — no page framing your app is connected, none answered
    within `SIGN_IN_REPLY_TIMEOUT_MS` (3 seconds), or it does not sign apps in.

  The page answers only an app that has reported its state: **call
  `reportAuthState(false)` first** — a request from an app that has not said
  whether anyone is signed in is answered `'unavailable'`. A request is not
  kept for later, and asking again before the answer comes is the same request.
  It signs in the one app it framed there; the request names nothing. If the
  page connects your app anew while a request waits (a board answers your
  app's hello with a fresh connect), the request is asked again on the new
  connection, with a fresh wait.
- **While the page is leaving for sign-in, every request is answered
  `'leaving'`** and starts nothing more — whether its own trip or one it started
  for another reason (a board signing several apps in). So reporting signed
  out and asking right behind it, as `connectApp()` does on a first load, is
  one trip and resolves.
- **How often.** The page framing your app goes on a sign-in trip for it at
  most once every `TRIP_COOLDOWN_MS` (15 seconds), counted from when a trip
  leaves and again from when it comes back, signed in or not, and answers
  `{ busy: ms }` until then — never more than that one cooldown. So an app that
  asks on every load cannot keep the person going round, and a person who signs
  out just after signing in is told how long to wait. Each app's cooldown is
  its own.
- **`pane.host`** says where your app is shown: `'board'`, or `null` until a
  page framing it connects, when that page did not say (or named a place this
  version does not know), or when your app is not framed at all.
  `onConnect({ host, lastSignIn })` is called each time one connects. Use it
  for wording: in a board, the board signs your app in by itself as soon as it
  reports signed out, so say so — but still offer the button: the board does
  not sign your app in again by itself after the person signed out, or after a
  trip that came back without signing it in.
- **`pane.lastSignIn`** says how the last sign-in trip the page framing your
  app made for it ended, when it came back without signing it in:
  `'cancelled'` (the person cancelled it) or `'failed'` (it did not finish for
  your app); `null` otherwise. A board says so in its connect, and does not try
  again by itself — so when it is set, say what happened instead of "signing in
  through your board", beside your button.
- **Shown alone at its own address**, nothing frames your app:
  `requestSignIn` answers `'unavailable'`, and `signIn()` / `connectApp()`
  sign in there by the platform's own sign-in page. To send someone from a
  pane to your app's own address, open it with `target="_blank"` — a board
  never lets a pane navigate the whole tab, and always lets it open a real
  window (`PANE_SANDBOX`, below).

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
import { createShell, PANE_SANDBOX } from '@boogy/web';

const shell = createShell({
  onReady: (id, service) => { /* the app speaks the protocol */ },
  onTitle: (id, text) => { /* show text in the frame header */ },
  onLocation: (id, path) => { /* save path; open the frame there next time */ },
  onAuthState: (id, signedIn) => { /* show the app's signed-in state */ },
  onSignInRequested: (id) => { /* the person chose to sign in to that pane's app */ },
  onHistoryState: (id, canBack, canForward, history) => {
    /* enable the frame's back and forward buttons; keep `history` with the
       pane's content and pass it as `history` when registering the frame the
       content moves to */
  },
});

// The frame's back and forward buttons:
shell.back('pane-1');
shell.forward('pane-1');

// The app's own origin, framed at its root, under the one app-frame sandbox
// and the feature grant the platform lists for it.
iframe.setAttribute('sandbox', PANE_SANDBOX);
iframe.setAttribute('allow', grantFromThePlatform);
shell.registerPane(iframe, {
  id: 'pane-1',
  service: 'notes',
  origin: 'https://notes-k3v9.boogy.app',
  mount: '/',
});
```

Register a frame once; the board reconnects it every time the frame loads.

**`PANE_SANDBOX`** is the `sandbox` of a frame holding an app from its own
origin — one grant for every app a board frames: scripts, forms, its own
origin's storage, downloads,
dialogs, and popups that are real windows. It grants **no top-level
navigation**, not even on the person's click: an app able to navigate the page
framing it could swap a board for a look-alike sign-in page. Use it as is.

**So an app in a frame never navigates the page around it.** It asks that page
to sign it in (`pane.requestSignIn()`), and sends the person anywhere else —
an OAuth consent, a payment page, its own address — in a window of
its own, with `target="_blank"` (or `window.open`). A `target="_top"` link in
a framed app does nothing.

**Signing apps in.** A board sends the page on a trip with
`startExchangeSignIn({ site, labels, returnTo })`: `site` is the boards origin
(where the trip starts and its verifier is kept, at the platform's exchange
page there), `labels` each app's label — the first DNS label of its address,
of any owner; `isServiceLabel(label)` says whether a string has that shape, so
check one before composing an origin from it — and `returnTo` the board page. One trip names at most
`MAX_SIGN_IN_PANES` (32) apps — the platform refuses a longer one outright, so
the call does not start it: name the first that many and the rest on a later
trip. Name only the apps that need it (the ones that reported signed out, one
just added, or one that asked). The person comes back to `returnTo` with
`#signin=partial` or `#signin=cancelled` when not every app was signed in:
take the marker out of the address (`history.replaceState`) before anything
else — the next trip's `returnTo` must not carry it — and tell those apps with
`registerPane(iframe, { …, lastSignIn: 'failed' | 'cancelled' })` (register
again to change it). Space trips by `TRIP_COOLDOWN_MS`.
Titles are trimmed, stripped of control and text-direction characters, and
capped at `MAX_TITLE_LENGTH` characters; a location outside the frame's own
`mount`, or longer than 2048 characters, is never reported.

**`service` is required.** A pane's `ready` names the service it believes it
is, and the board checks it against `service`; a pane registered with an empty
`service` could not be checked, so it is never connected and nothing it says
is heard.

**Sign-in state and requests.** A pane's `auth-state` reports, and its
sign-in requests, are heard only from that pane's own frame and origin, on the
page the board connected, once that page has named the `service` registered
for it. `onSignInRequested(id)` is called only for a page whose last report
was signed out; the shell itself answers a page that has not reported
`'unavailable'`, and one that reported signed in `'already_signed_in'`. Sign in
that registered app, never one the request names (it names none), and return
what became of it — `'leaving'`, `{ busy: ms }` or `'unavailable'`, at once or
as a promise; the shell sends that back to the page that asked, and to no
page the frame has loaded since. An app can ask as often as it likes, so limit
it: one trip at a time, and a cooldown after every trip, counted again from
when the board comes back from it.

**The host.** Every `connect` tells the app where it is shown: `'board'`, the
default and the only one — an app shown alone is at its own address, not
framed. An app treats a
`connect` that names no host, or one it does not know, as not knowing where it
is shown, never as a board — and still connects. Every optional field of a
`connect` (`host`, `lastSignIn`, `history`, `zoom`) is read on its own: one an
app cannot read is ignored, and costs the rest nothing.

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

## Live channels

A service can push events to its open pages over a channel it declares in its
manifest. `openStream` is the browser half: it connects to the platform's
streaming gateway, subscribes with a short-lived grant your service mints,
renews the grant before it expires, reconnects when the connection drops —
including when the server ends it — and hands you each typed event
(`{ type, v, ts, data }`) once, however it arrived.

Your service mints the ticket from one of its own routes — the grant from
`ws_mint_subscribe_grant(channel, ttl)` plus where to subscribe:
`{ grant, ttl_secs, owner, service, channel }`, with `owner` and `service` taken
from the service's own identity, never guessed from the hostname.

```ts
import { io } from 'socket.io-client';
import { openStream } from '@boogy/web';

const stream = openStream({
  io,                                            // socket.io-client v4, passed in
  mint: async () => {
    const r = await fetch('api/live/grant', { method: 'POST' });
    if (!r.ok) throw new Error(`grant: ${r.status}`); // retried after a pause
    return r.json();
  },
  onEvent: (e) => { if (e.type === 'message.received') show(e.data); },
  onResync: () => reload(),                      // after a reconnect: re-read
});
stream.close();                                  // when the page is done with it
```

In Preact, `useStream(options)` keeps one stream open while the component is
mounted (and `enabled` is not `false`) and returns its status: `connecting`,
`live` or `offline`.

The stream is a hint, not the record. After a reconnect, events published while
the page was away may be gone, so `onResync` is where you re-read real state
from your service. Events are de-duplicated by their sequence number; an
unsequenced one is always delivered. `onEvent`'s third argument says whether an
event is replayed history, sent once on subscribe, rather than something that
just happened — a typing signal from then, say, is long over.

For chat-shaped pages, `Bubble` takes a `status` (`sent`, `delivered` or
`seen`) that draws delivery marks after its time, and `TypingBubble` shows the
other person typing.

## Errors

The SDK throws a single error type with a closed-enum `code`. Always discriminate on `code`, never on the message string.

```ts
import { BoogyError } from '@boogy/web';

try {
  await boogy.fetch('alice/reddit-clone', '/api/posts');
} catch (e) {
  if (e instanceof BoogyError) {
    switch (e.code) {
      case 'sign_in_aborted':  // user closed the sign-in popup, or an app-token sign-in did not complete
        break;
      case 'consent_denied':   // user clicked Cancel on consent
        break;
      case 'popup_blocked':    // the install popup was blocked: recreate with authMode:'redirect'
        break;
      case 'app_not_found':    // bad {owner}/{service} — check your config
        break;
      case 'network':          // offline or CORS
        break;
      case 'sign_in_unavailable': // on its own origin with no page framing it
        break;
      case 'sign_in_busy':        // a sign-in went moments ago: try again shortly
        break;
      case 'sign_in_required':    // an app-token session ended: call requestAppToken again
        break;
      case 'url_not_allowed':     // an app-token session's fetch was given a URL outside apiOrigin
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
