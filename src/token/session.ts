// App-token sessions: keeping a person signed in to a service from a website
// on another origin.
//
// `completeAppToken` redeems a sign-in for a short-lived access token and a
// refresh token, and keeps both here. `appTokenSession(service)` hands the
// page a live access token, renewing it with the refresh token before it runs
// out, so the person is not sent back through sign-in while they keep using
// the page. The API never hands the refresh token to your code, but the
// page's storage does hold it.
//
// Each renewal ROTATES the refresh token: the platform answers with a new one,
// and the one presented is superseded. Presenting a superseded token — at a
// renewal or at sign-out — is read as theft: the platform ends the whole
// sign-in. So no two renewals, and no renewal and sign-out, may ever present
// the same token. Within a tab one renewal is shared by every caller; across
// tabs every renewal and every sign-out runs under one `navigator.locks` lock
// per service and re-reads the stored session first, because another tab may
// already have rotated it. A write that cannot reach shared storage clears
// the shared copy first, so no tab is ever left reading a token another has
// superseded. Storage failures are tracked per key: one service's failure
// changes nothing for another's.
//
// Where the session is kept: this website's `localStorage`, so every tab and
// a reload stay signed in. When that store refuses (blocked storage, private
// mode), or the browser has no `navigator.locks` to keep tabs from racing a
// rotation, the session lives in this tab's memory instead: signed in for the
// tab, never throwing.
//
// A sign-out the platform did not receive is kept, under its own key, and
// sent again from any later use of the service on this website, until the
// platform answers or the token would have lapsed anyway. A sign-out is
// claimed under the lock and sent outside it, so a renewal never waits on a
// sign-out's request. A new sign-in to a service this website already holds
// one for signs the old one out the same way, with the token it holds now.
//
// A request that times out (`TOKEN_REQUEST_TIMEOUT_MS`) is transient: the
// session is kept and the same token is sent again after a back-off. If the
// platform had rotated before the answer was lost, it hands that retry the
// same replacement, for a minute after it rotated, so the deadline is kept
// short enough for several retries to land inside that minute.
import { BoogyError } from '../errors';
import { parseApp } from '../internal/urls';

/** Where a session is kept: this prefix, then `owner/service`. */
export const SESSION_KEY_PREFIX = 'boogy.app-token.session.v1:';
/** An access token with no more than this left is renewed before use. */
export const REFRESH_SKEW_MS = 60_000;
/** The token endpoint, on the auth origin: redeems a sign-in, renews a session. */
export const TOKEN_PATH = '/sso/token';
/** The sign-out endpoint, on the auth origin. */
export const REVOKE_PATH = '/sso/token/revoke';
/** The cross-tab lock: this prefix, then `owner/service`. */
export const LOCK_PREFIX = 'boogy.app-token:';
/** The first wait after a request that could not be decided; it doubles per failure in a row. */
export const BACKOFF_BASE_MS = 1_000;
/** The longest wait between attempts, whatever `Retry-After` asks. */
export const BACKOFF_MAX_MS = 60_000;
/** Where sign-outs the platform has not yet received are kept: this prefix, then `owner/service`. */
export const REVOKE_KEY_PREFIX = 'boogy.app-token.revoke.v1:';
/** At most this many sign-outs are kept owing; a newer one drops the oldest. */
export const MAX_PENDING_REVOKES = 4;
/** Every request to the token endpoints gives up after this long — a
 *  transient failure, never a sign-out. Short, because a renewal whose answer
 *  is lost is handed the same replacement only for a minute after the
 *  platform rotated: at 10 s, about four retries fit inside that minute. */
export const TOKEN_REQUEST_TIMEOUT_MS = 10_000;

/** The part of `navigator.locks` a session uses. */
export interface SessionLocks {
  request<T>(name: string, callback: (lock: unknown) => Promise<T> | T): Promise<T>;
}

/** The browser surfaces a session touches — injectable, so it can be tested. */
export interface SessionEnv {
  /** This website's `localStorage`; `null` when the browser refuses it. */
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  fetch: typeof fetch;
  now: () => number;
  /** `navigator.locks`; absent where the browser has none. */
  locks?: SessionLocks | null;
  /** A signal that aborts after `ms`; `AbortSignal.timeout` by default. */
  deadline?: (ms: number) => AbortSignal;
}

/** Options for [`appTokenSession`]. */
export interface AppTokenSessionOptions {
  /** The service's own address, e.g. `https://notes-api-k3v9.boogy.app`. When
   *  set, `fetch` refuses any URL on another origin, sending nothing. */
  apiOrigin?: string;
}

/** A person's sign-in to one service, held for this website. */
export interface AppTokenSession {
  /** The `owner/service` it is for. */
  readonly service: string;
  /** A live access token, refreshed when it has under 60 s left. Rejects with
   *  BoogyError('sign_in_required') when the person must sign in again. */
  accessToken(): Promise<string>;
  /** fetch() with Authorization: Bearer — to whatever URL it is given, unless
   *  `apiOrigin` is set. On a 401 from the service, refreshes once (forced)
   *  and retries once; a 401 to a token a forced refresh issued is returned
   *  as it is, so a route that always refuses cannot churn the sign-in. */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  /** Revokes this website's session for the service and forgets it. */
  signOut(): Promise<void>;
  /** Whether a session is held at all (no network). */
  signedIn(): boolean;
}

/** What is kept for one service. Expiries are epoch milliseconds by THIS
 *  device's clock, taken when the tokens were received. */
export interface SessionRecord {
  authOrigin: string;
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
  /** After a renewal that could not be decided, none is sent before this. */
  retryAt?: number;
  /** Undecided renewals in a row. */
  failures?: number;
  /** Written by a renewal forced by the service's 401: a 401 to this access
   *  token is not renewed again. An ordinary renewal clears it. */
  forced?: boolean;
}

/** A sign-out the platform has not yet received. */
interface PendingRevoke {
  authOrigin: string;
  refreshToken: string;
  refreshExpiresAt: number;
  retryAt: number;
  failures: number;
  /** Some tab is sending it; no other tab sends it before this. */
  claimedUntil?: number;
}

/** How long a claim on an owed sign-out lasts: the request's own deadline,
 *  and a margin. A tab that goes away mid-send leaves a claim that lapses. */
const CLAIM_MS = TOKEN_REQUEST_TIMEOUT_MS + 5_000;

/** An access token, and whether a forced renewal issued it. */
interface Held {
  token: string;
  forced: boolean;
}

/** What one tab keeps beside the shared store. */
interface Tab {
  /** What shared storage cannot hold. */
  memory: Map<string, string>;
  /** Keys shared storage refused to write: from then on this tab keeps its
   *  own copy of THOSE keys. Every other key is unaffected. */
  failedKeys: Set<string>;
  /** The renewal in flight, per service: one per tab, shared by its callers. */
  inflight: Map<string, Promise<Held>>;
  /** The owed sign-outs being sent, per service: one per tab. */
  drains: Map<string, Promise<void>>;
}

const tabs = new WeakMap<SessionEnv, Tab>();

function tabOf(env: SessionEnv): Tab {
  let tab = tabs.get(env);
  if (!tab) {
    tab = { memory: new Map(), failedKeys: new Set(), inflight: new Map(), drains: new Map() };
    tabs.set(env, tab);
  }
  return tab;
}

/** Shared storage, if this tab may use it for `key`: it exists, there is a
 *  lock to keep tabs from racing a rotation, and it has not refused `key`. */
function sharedStore(env: SessionEnv, tab: Tab, key: string): SessionEnv['storage'] {
  return env.storage && env.locks && !tab.failedKeys.has(key) ? env.storage : null;
}

function readRaw(env: SessionEnv, key: string): string | null {
  const tab = tabOf(env);
  const store = sharedStore(env, tab, key);
  if (store) {
    try {
      return store.getItem(key);
    } catch {
      /* unreadable now: this tab's own copy, if it has one */
    }
  }
  return tab.memory.get(key) ?? null;
}

/**
 * Write `value` under `key`: to shared storage, or — when that refuses — to
 * this tab's memory. `supersedes` says the value replaces whatever shared
 * storage holds under `key` (a session: its token was just rotated), so
 * before the tab keeps its own copy, the shared one is removed. A list of
 * owed sign-outs does not supersede the shared one — other tabs add to it —
 * so it is never removed that way.
 */
function writeRaw(env: SessionEnv, key: string, value: string, supersedes: boolean): void {
  const tab = tabOf(env);
  const store = sharedStore(env, tab, key);
  if (store) {
    try {
      store.setItem(key, value);
      return;
    } catch {
      // The old value must not outlive this write: another tab would present
      // a token this one has superseded. Remove it — which may also free the
      // space the write needed — and try once more.
      try {
        store.removeItem(key);
      } catch {
        /* nothing more can be done for the shared copy */
      }
      try {
        store.setItem(key, value);
        return;
      } catch {
        tab.failedKeys.add(key);
      }
    }
  }
  // Whatever brought the value here, shared storage must not keep one it
  // supersedes: another tab or a reload would present a retired token.
  if (supersedes && env.storage) {
    try {
      env.storage.removeItem(key);
    } catch {
      /* the next write this tab keeps in memory tries again */
    }
  }
  tab.memory.set(key, value);
}

function removeRaw(env: SessionEnv, key: string): void {
  const tab = tabOf(env);
  tab.memory.delete(key);
  // Cleared from shared storage only where this tab keeps `key` there: a key
  // it keeps in memory may by now hold what other tabs wrote.
  const store = sharedStore(env, tab, key);
  if (store) {
    try {
      store.removeItem(key);
    } catch {
      tab.failedKeys.add(key);
    }
  }
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const LOOPBACK = /^(localhost|.+\.localhost|127\.0\.0\.1|\[::1\])$/;

/** A bare origin a token may be sent to: `https`, or `http` on loopback only. */
export function isTrustedOrigin(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return false;
  }
  if (url.origin !== v) return false;
  return url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK.test(url.hostname));
}

function parseJson(raw: string | null): unknown {
  try {
    return JSON.parse(raw ?? 'null');
  } catch {
    return null;
  }
}

function readSession(env: SessionEnv, key: string): SessionRecord | null {
  const v = parseJson(readRaw(env, key));
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const optional = (x: unknown) => x === undefined || isFiniteNumber(x);
  if (
    !isTrustedOrigin(r.authOrigin) ||
    !isText(r.accessToken) ||
    !isFiniteNumber(r.accessExpiresAt) ||
    !isText(r.refreshToken) ||
    !isFiniteNumber(r.refreshExpiresAt) ||
    !optional(r.retryAt) ||
    !optional(r.failures) ||
    !(r.forced === undefined || typeof r.forced === 'boolean')
  ) {
    return null;
  }
  return r as unknown as SessionRecord;
}

function readPending(env: SessionEnv, key: string): PendingRevoke[] {
  const v = parseJson(readRaw(env, key));
  if (!Array.isArray(v)) return [];
  return v.filter((e): e is PendingRevoke => {
    if (typeof e !== 'object' || e === null) return false;
    const r = e as Record<string, unknown>;
    return (
      isTrustedOrigin(r.authOrigin) &&
      isText(r.refreshToken) &&
      isFiniteNumber(r.refreshExpiresAt) &&
      isFiniteNumber(r.retryAt) &&
      isFiniteNumber(r.failures) &&
      (r.claimedUntil === undefined || isFiniteNumber(r.claimedUntil))
    );
  });
}

function writePending(env: SessionEnv, key: string, list: PendingRevoke[]): void {
  if (list.length) writeRaw(env, key, JSON.stringify(list), false);
  else removeRaw(env, key);
}

/** Owe a sign-out of `record`'s refresh token, under `pendingKey` — replacing
 *  any entry for the same token, and dropping the oldest past
 *  [`MAX_PENDING_REVOKES`]. Call under the service's lock. `claimedUntil`
 *  says this tab is sending it now. */
function oweSignOut(env: SessionEnv, pendingKey: string, record: SessionRecord, claimedUntil?: number): PendingRevoke {
  const entry: PendingRevoke = {
    authOrigin: record.authOrigin,
    refreshToken: record.refreshToken,
    refreshExpiresAt: record.refreshExpiresAt,
    retryAt: 0,
    failures: 0,
    ...(claimedUntil === undefined ? {} : { claimedUntil }),
  };
  const owed = readPending(env, pendingKey).filter((e) => e.refreshToken !== record.refreshToken);
  writePending(env, pendingKey, [...owed, entry].slice(-MAX_PENDING_REVOKES));
  return entry;
}

/** The session a token response grants, or `null` when it is not a token
 *  pair. Expiries are counted from `now` — this device's clock at receipt —
 *  plus the `*_in` the platform sent, never from anything inside a token. */
export function sessionFromGrant(body: unknown, authOrigin: string, now: number): SessionRecord | null {
  if (typeof body !== 'object' || body === null || !isTrustedOrigin(authOrigin)) return null;
  const b = body as Record<string, unknown>;
  if (
    !isText(b.access_token) ||
    b.token_type !== 'Bearer' ||
    !isFiniteNumber(b.expires_in) ||
    !isText(b.refresh_token) ||
    !isFiniteNumber(b.refresh_expires_in)
  ) {
    return null;
  }
  return {
    authOrigin,
    accessToken: b.access_token,
    accessExpiresAt: now + b.expires_in * 1000,
    refreshToken: b.refresh_token,
    refreshExpiresAt: now + b.refresh_expires_in * 1000,
  };
}

/** Run `fn` under `service`'s cross-tab lock — or directly, where there is
 *  none and the session is this tab's alone. A lock the browser will not grant
 *  is `network`; whatever `fn` throws passes through unchanged. */
async function withLock<T>(env: SessionEnv, service: string, fn: () => Promise<T>): Promise<T> {
  if (!env.locks) return fn();
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    outcome = await env.locks.request(LOCK_PREFIX + service, async () => {
      try {
        return { ok: true as const, value: await fn() };
      } catch (error) {
        return { ok: false as const, error };
      }
    });
  } catch {
    throw new BoogyError('network', 'the browser would not grant the sign-in lock', service);
  }
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

/** Keep `record` as `service`'s session (`owner/service`), under the same
 *  lock renewals take, so a renewal in another tab cannot overwrite it.
 *
 *  A sign-in this one replaces would otherwise stay live at the platform
 *  until it lapsed, with nothing on this website able to end it. So, under
 *  that lock, the token the stored session holds NOW — the one its last
 *  renewal left, never one it retired — is owed a sign-out before the new
 *  pair is written, and the owed sign-out is sent once the lock is released,
 *  retried as any other — and, like any other, dropped unsent once the token
 *  would have lapsed. */
export async function storeSession(env: SessionEnv, service: string, record: SessionRecord): Promise<void> {
  await withLock(env, service, async () => {
    const key = SESSION_KEY_PREFIX + service;
    const replaced = readSession(env, key);
    if (replaced && replaced.refreshToken !== record.refreshToken) {
      oweSignOut(env, REVOKE_KEY_PREFIX + service, replaced);
    }
    writeRaw(env, key, JSON.stringify(record), true);
  });
  // Sends what is owed, in the background (see `appTokenSession`).
  try {
    appTokenSession(service, {}, env);
  } catch {
    /* a service that does not parse owes nothing a session could send */
  }
}

/** A signal that aborts after [`TOKEN_REQUEST_TIMEOUT_MS`]. */
export function requestDeadline(env: SessionEnv): AbortSignal {
  if (env.deadline) return env.deadline(TOKEN_REQUEST_TIMEOUT_MS);
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), TOKEN_REQUEST_TIMEOUT_MS);
  return controller.signal;
}

/** POST `body` as JSON to a token endpoint: no cookies, and a deadline. */
function tokenPost(env: SessionEnv, url: string, body: unknown, keepalive = false): Promise<Response> {
  const init: RequestInit = {
    method: 'POST',
    credentials: 'omit',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: requestDeadline(env),
  };
  // A sign-out should still land when the page is closing.
  if (keepalive) init.keepalive = true;
  return env.fetch(url, init);
}

const windowEnvs = new WeakMap<object, SessionEnv>();

/** The page's own window as a [`SessionEnv`] — one per window, so every
 *  session in a tab shares its renewal in flight. */
export function windowSessionEnv(win: Window = window): SessionEnv {
  const cached = windowEnvs.get(win);
  if (cached) return cached;
  let storage: SessionEnv['storage'];
  try {
    storage = win.localStorage ?? null;
  } catch {
    storage = null;
  }
  const manager = (win.navigator as { locks?: SessionLocks } | undefined)?.locks;
  const env: SessionEnv = {
    storage,
    fetch: win.fetch.bind(win),
    now: () => Date.now(),
    locks: typeof manager?.request === 'function' ? { request: (name, cb) => manager.request(name, cb) } : null,
  };
  windowEnvs.set(win, env);
  return env;
}

/** A readable refusal: the platform decided, and the person must sign in again. */
const REFUSED = new Set([400, 401, 403]);

/** `Retry-After` in milliseconds when it is readable delta-seconds, else 0. */
function retryAfterMs(res: Response): number {
  const v = res.headers.get('retry-after')?.trim();
  return v && /^\d+$/.test(v) ? Number(v) * 1000 : 0;
}

/** When to try again after `failures` undecided attempts in a row: 1 s,
 *  doubling, or longer when `Retry-After` asks — never past the cap. */
function retryAtAfter(failures: number, res: Response | null, now: number): number {
  const doubling = BACKOFF_BASE_MS * 2 ** Math.min(failures - 1, 30);
  const hinted = res ? retryAfterMs(res) : 0;
  return now + Math.min(BACKOFF_MAX_MS, Math.max(doubling, hinted));
}

/** Whether `retryAt` still holds an attempt back. A wait longer than the cap
 *  was not chosen here — the device clock moved back since — so it does not:
 *  a clock change must not stall renewal. */
function waiting(retryAt: number, now: number): boolean {
  return now < retryAt && retryAt - now <= BACKOFF_MAX_MS;
}

/** Whether another send of `entry` is in flight. A claim longer than a claim
 *  lasts was not made at this time (the clock moved back), so it is not one. */
function claimed(entry: PendingRevoke, now: number): boolean {
  const until = entry.claimedUntil;
  return until !== undefined && now < until && until - now <= CLAIM_MS;
}

/** Whether `entry` should be sent now: not lapsed, not waiting, not claimed. */
function due(entry: PendingRevoke, now: number): boolean {
  return entry.refreshExpiresAt > now && !waiting(entry.retryAt, now) && !claimed(entry, now);
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== 'undefined' && input instanceof Request;
}

/** The origin `input` is addressed to, or `null` when it is not an absolute URL. */
function originOf(input: RequestInfo | URL): string | null {
  const raw = isRequest(input) ? input.url : input instanceof URL ? input.href : String(input);
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/** `init` with `Authorization: Bearer <token>`, and no cookies unless asked. */
function withBearer(input: RequestInfo | URL, init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers ?? (isRequest(input) ? input.headers : undefined));
  headers.set('authorization', `Bearer ${token}`);
  return { ...init, headers, credentials: init?.credentials ?? 'omit' };
}

/**
 * The person's sign-in to `service` (`owner/service`) on this website, as
 * `completeAppToken` kept it. Throws `app_not_found` for a malformed service,
 * and `config_unavailable` for an `apiOrigin` that is not an origin.
 */
export function appTokenSession(
  service: string,
  options: AppTokenSessionOptions = {},
  env: SessionEnv = windowSessionEnv(),
): AppTokenSession {
  const { owner, service: name } = parseApp(service);
  const id = `${owner}/${name}`;
  const key = SESSION_KEY_PREFIX + id;
  const pendingKey = REVOKE_KEY_PREFIX + id;
  const tab = tabOf(env);
  let apiOrigin: string | null = null;
  if (options.apiOrigin !== undefined) {
    const trimmed = String(options.apiOrigin).replace(/\/+$/, '');
    if (!isTrustedOrigin(trimmed)) {
      throw new BoogyError('config_unavailable', `apiOrigin must be an https origin, got "${options.apiOrigin}"`, id);
    }
    apiOrigin = trimmed;
  }

  const read = () => readSession(env, key);
  const write = (record: SessionRecord) => writeRaw(env, key, JSON.stringify(record), true);
  const forget = () => removeRaw(env, key);
  const signInRequired = (why: string) => new BoogyError('sign_in_required', why, id);
  const held = (record: SessionRecord): Held => ({ token: record.accessToken, forced: record.forced === true });

  /** After a renewal that could not be decided: wait before the next, and
   *  hand out the token held if it still works. The session is kept. */
  function backOff(record: SessionRecord, rejected: string | undefined, res: Response | null): Held {
    const now = env.now();
    const failures = Math.max(0, record.failures ?? 0) + 1;
    const retryAt = retryAtAfter(failures, res, now);
    write({ ...record, failures, retryAt });
    return heldOrUnavailable(record, rejected, now, retryAt);
  }

  /** The token held, if it has not expired and the service did not just
   *  refuse it; otherwise `network`, saying when the next attempt goes. */
  function heldOrUnavailable(record: SessionRecord, rejected: string | undefined, now: number, retryAt: number): Held {
    if (record.accessToken !== rejected && record.accessExpiresAt > now) return held(record);
    const wait = Math.ceil((retryAt - now) / 1000);
    throw new BoogyError('network', `the sign-in could not be renewed; it is tried again in ${wait} s`, id);
  }

  /** One renewal, holding the lock. `rejected` is a token the service just
   *  answered 401 to: never handed out again, whatever its expiry says. */
  async function renewHeld(rejected: string | undefined): Promise<Held> {
    // Re-read inside the lock: another tab may have rotated the token since
    // this one last read it, and presenting the superseded one reads as theft.
    const record = read();
    if (!record) throw signInRequired('no sign-in is held for this service');
    const now = env.now();
    if (record.accessToken !== rejected && record.accessExpiresAt - now > REFRESH_SKEW_MS) return held(record);
    // Lapsed: the platform would only refuse it. Nothing is sent.
    if (record.refreshExpiresAt <= now) {
      forget();
      throw signInRequired('the sign-in lapsed unused');
    }
    if (record.retryAt !== undefined && waiting(record.retryAt, now)) {
      return heldOrUnavailable(record, rejected, now, record.retryAt);
    }
    let res: Response;
    try {
      res = await tokenPost(env, `${record.authOrigin}${TOKEN_PATH}`, {
        grant_type: 'refresh_token',
        refresh_token: record.refreshToken,
      });
    } catch {
      // Offline, an answer without CORS, or past the deadline — the page
      // cannot tell which, so it is never read as a refusal.
      return backOff(record, rejected, null);
    }
    if (res.status === 200) {
      const body: unknown = await res.json().catch(() => null);
      const next = sessionFromGrant(body, record.authOrigin, env.now());
      if (!next) {
        // The platform rotates before it answers, so the token held may
        // already be superseded: it must not be presented again.
        forget();
        throw signInRequired('the platform answered a renewal without a token pair');
      }
      const forced = rejected !== undefined;
      write(forced ? { ...next, forced } : next);
      return { token: next.accessToken, forced };
    }
    if (REFUSED.has(res.status)) {
      forget();
      throw signInRequired(`the platform refused to renew the sign-in (${res.status})`);
    }
    return backOff(record, rejected, res);
  }

  /** A renewal, shared by every caller in this tab. */
  function renew(rejected?: string): Promise<Held> {
    const running = tab.inflight.get(id);
    if (running) return running.then((h) => (h.token === rejected ? renew(rejected) : h));
    const run = withLock(env, id, () => renewHeld(rejected)).finally(() => tab.inflight.delete(id));
    tab.inflight.set(id, run);
    return run;
  }

  /** Under the lock: drop lapsed owed sign-outs, and claim the first one due,
   *  so no other tab sends it meanwhile. */
  function claimHeld(): PendingRevoke | null {
    const now = env.now();
    const all = readPending(env, pendingKey);
    const live = all.filter((e) => e.refreshExpiresAt > now);
    const entry = live.find((e) => due(e, now)) ?? null;
    if (entry) entry.claimedUntil = now + CLAIM_MS;
    if (entry || live.length !== all.length) writePending(env, pendingKey, live);
    return entry;
  }

  /** Under the lock: record how a send of `entry` ended, on the list as it
   *  stands now — other tabs may have added to it meanwhile. */
  function recordHeld(entry: PendingRevoke, res: Response | null): void {
    const now = env.now();
    const settled = res !== null && (res.status === 200 || res.status === 400);
    const list = readPending(env, pendingKey)
      .filter((e) => e.refreshExpiresAt > now && !(settled && e.refreshToken === entry.refreshToken))
      .map((e) => {
        if (e.refreshToken !== entry.refreshToken) return e;
        const failures = Math.max(0, e.failures) + 1;
        const { claimedUntil: _released, ...rest } = e;
        return { ...rest, failures, retryAt: retryAtAfter(failures, res, now) };
      });
    writePending(env, pendingKey, list);
  }

  /** Send one claimed sign-out, OUTSIDE the lock — so a renewal never waits on
   *  it — and record the outcome under the lock. `keepalive` is for the
   *  attempt made at sign-out, when the page may be closing. */
  async function sendClaimed(entry: PendingRevoke, keepalive: boolean): Promise<void> {
    let res: Response | null;
    try {
      res = await tokenPost(env, `${entry.authOrigin}${REVOKE_PATH}`, { refresh_token: entry.refreshToken }, keepalive);
    } catch {
      res = null;
    }
    await withLock(env, id, async () => recordHeld(entry, res));
  }

  /** Send what is owed, one claim at a time, once per tab at a time. */
  function drain(): Promise<void> {
    const running = tab.drains.get(id);
    if (running) return running;
    const run = (async () => {
      for (let i = 0; i < MAX_PENDING_REVOKES; i++) {
        const entry = await withLock(env, id, async () => claimHeld());
        if (!entry) return;
        await sendClaimed(entry, false);
      }
    })().finally(() => tab.drains.delete(id));
    tab.drains.set(id, run);
    return run;
  }

  /** In the background: send owed sign-outs if any is due or has lapsed. */
  function sendOwed(): void {
    const now = env.now();
    const owed = readPending(env, pendingKey).some((e) => e.refreshExpiresAt <= now || due(e, now));
    if (owed) drain().catch(() => undefined);
  }

  async function current(): Promise<Held> {
    sendOwed();
    const record = read();
    if (!record) throw signInRequired('no sign-in is held for this service');
    if (record.accessExpiresAt - env.now() > REFRESH_SKEW_MS) return held(record);
    return renew();
  }

  async function sessionFetch(given: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // A URL object is copied first: the URL checked is the URL sent, however
    // the caller's object changes meanwhile.
    const input = given instanceof URL ? given.href : given;
    if (apiOrigin !== null && originOf(input) !== apiOrigin) {
      throw new BoogyError('url_not_allowed', `fetch() sends the access token only to ${apiOrigin}`, id);
    }
    const again = isRequest(input) ? input.clone() : input;
    const first = await current();
    const res = await env.fetch(input, withBearer(input, init, first.token));
    // One forced renewal per lineage: a 401 to a token a forced renewal
    // issued is the service's answer, not a reason to rotate again.
    if (res.status !== 401 || first.forced) return res;
    const renewed = await renew(first.token);
    return env.fetch(again, withBearer(again, init, renewed.token));
  }

  async function signOut(): Promise<void> {
    // A renewal in flight in this tab finishes first, so the token revoked is
    // the one it leaves.
    for (let running = tab.inflight.get(id); running; running = tab.inflight.get(id)) {
      await running.catch(() => undefined);
    }
    const mine = await withLock(env, id, async () => {
      const record = read();
      if (!record) return null;
      // Owed before it is forgotten, so a revoke that cannot land is sent
      // again later; claimed, because this tab sends it now. Forgotten before
      // it is sent, so nothing here presents the token while it is revoked.
      const entry = oweSignOut(env, pendingKey, record, env.now() + CLAIM_MS);
      forget();
      return entry;
    });
    if (mine) await sendClaimed(mine, true);
    await drain();
  }

  sendOwed();
  return {
    service: id,
    accessToken: async () => (await current()).token,
    fetch: sessionFetch,
    signOut,
    signedIn: () => read() !== null,
  };
}
