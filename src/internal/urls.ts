import { BoogyError } from '../errors';
import { platformConfig } from './platform-config';

/**
 * Parse an `owner/service` app identifier.
 * Throws `BoogyError('app_not_found')` on any malformed input (scheme prefix,
 * empty segments, wrong number of segments).
 */
export function parseApp(app: string): { owner: string; service: string } {
  if (!app || app.includes('://')) {
    throw new BoogyError('app_not_found', `Invalid app identifier: "${app}"`);
  }
  const parts = app.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new BoogyError(
      'app_not_found',
      `App identifier must be "owner/service", got: "${app}"`,
    );
  }
  return { owner: parts[0], service: parts[1] };
}

/**
 * Strip the scheme and trailing slash from a host string.
 * 'https://boogy.ai' → 'boogy.ai'
 */
export function baseFromHost(host: string): string {
  return host.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * Build the origin that serves the given owner's apps.
 *
 * Split by whether `owner` is THIS origin's own owner
 * (`platformConfig().owner`) — the two cases genuinely differ, not just in
 * implementation but in what's correct:
 *
 * - **Own owner** (every pane on a board, and any single-app page): returns
 *   the page's OWN origin (`location.origin`), never a constructed one. This
 *   is correct in production too — a tenant page genuinely IS at
 *   `https://<handle>.<base>` — so it's strictly better than reconstructing
 *   the same origin from parts, and it's what makes this work under any edge
 *   (a local dev fake platform included), because it names no domain at all.
 *
 * - **A different owner** is UNSUPPORTED and throws. `Boogy.fetch`/
 *   `currentUser`/`signOut(app)` may in principle name a service owned by
 *   someone else — a frontend-only pane talking to another owner's backend
 *   — but the page's own origin is wrong there, and `platformConfig()` does
 *   not carry a tenant BASE domain to construct one from: it returns only
 *   `owner`, `authOrigin` and `shellOrigins`. Reconstructing a base domain by
 *   stripping a label off `authOrigin`'s host is not a safe derivation —
 *   the host resolves `authOrigin` from `BOOGY_AUTH_ORIGIN`, which accepts
 *   any absolute origin an operator sets, so that string is not guaranteed
 *   to be `auth.<base>` at all. Guessing it anyway is exactly the
 *   derive-instead-of-be-told defect this module exists to remove, and it
 *   would ship untested: the local dev fake platform this wiring targets
 *   serves same-owner sign-in only, so a wrong guess in this branch would
 *   never fail in dev.
 *
 *   **Required host-side follow-up**: `/boogy/config` needs an explicit
 *   tenant base-domain field before a cross-owner `appOrigin` can be
 *   supported. Nothing exercises this path today (every board pane and
 *   every squad call is same-owner), so throwing costs no working behaviour.
 *
 * Throws (via `platformConfig()`) if config was never loaded — there is no
 * hostname-derived fallback for the own-owner branch either.
 */
export function appOrigin(owner: string): string {
  const config = platformConfig();
  if (owner === config.owner) {
    return location.origin;
  }
  throw new BoogyError(
    'config_unavailable',
    `appOrigin("${owner}") was asked for a DIFFERENT owner than this origin serves ` +
      `("${config.owner}"). The platform config does not carry a tenant base domain, so a ` +
      `cross-owner origin cannot be constructed — this needs a host-side addition to ` +
      `/boogy/config (an explicit base-domain field), not a guess made here.`,
  );
}

/**
 * Build the auth origin — where `/authorize` and `/_agents/*` are served.
 *
 * Read from `platformConfig().authOrigin`, never derived from this page's
 * own hostname: the auth origin lives on a different registrable domain than
 * a tenant subdomain in production, and guessing it from the URL bar is
 * exactly the defect `platformConfig()` exists to remove. Throws if config
 * was never loaded or failed to load — there is no fallback. In particular,
 * a verified custom domain has no `/boogy/*` surface at all, so
 * `loadPlatformConfig()` there rejects and this throws too; that is the
 * intended, honest failure (decision 3), not a bug to work around with a
 * hostname-derived guess.
 */
export function authOrigin(): string {
  return platformConfig().authOrigin;
}

/**
 * Build the full `/authorize` URL on the auth subdomain.
 *
 * Query parameters: aud (one per entry in `services`, repeated — NOT a
 * comma-joined single value and NOT last-wins), app_origin, redirect, state,
 * code_challenge, mode.
 */
export function authorizeUrl(p: {
  owner: string;
  services: readonly string[];
  redirect: string;
  state: string;
  codeChallenge: string;
  mode: 'popup' | 'redirect';
}): string {
  const url = new URL(`${authOrigin()}/authorize`);
  for (const service of p.services) {
    url.searchParams.append('aud', `boogy://${p.owner}/services/${service}`);
  }
  url.searchParams.set('app_origin', appOrigin(p.owner));
  url.searchParams.set('redirect', p.redirect);
  url.searchParams.set('state', p.state);
  url.searchParams.set('code_challenge', p.codeChallenge);
  url.searchParams.set('mode', p.mode);
  return url.toString();
}

/**
 * How many audiences the platform accepts on a single authorization request.
 *
 * Mirrors the host's `sso::MAX_AUDS`, whose own doc comment carries the
 * derivation: each (audience, subject) pair costs ~136 bytes of token, so 32
 * panes is ~4.9 KB against the 8 KB single-header line a proxy commonly caps a
 * request at, with real headroom, while 64 would be ~9.2 KB and back over that
 * line. It is not a consent-readability figure (that rationale applied before
 * self-owned audiences skipped the consent screen entirely) — it is derived
 * from the header budget, and `parseApps` refuses a batch over it rather than
 * silently sending fewer than the caller asked for.
 */
export const MAX_AUDIENCES = 32;

/**
 * Parse one or more `owner/service` app identifiers destined for a single
 * `/authorize` request, and validate them as a batch — the shape a batch
 * connect (e.g. every pane of a board, signed in with one consent
 * round-trip) needs that a single app never does:
 *
 * - A bare string is normalised to a one-app batch.
 * - The batch must be non-empty.
 * - Every entry must resolve to the same owner. A single authorization
 *   request may only span one owner's services; a batch that mixes owners
 *   is refused here, naming the entry that doesn't match, rather than sent
 *   and refused anonymously.
 * - A repeated app is silently collapsed to one — the same audience is
 *   never sent twice.
 * - The platform accepts at most `MAX_AUDIENCES` distinct audiences per
 *   authorization request. A larger batch is refused here, naming the count
 *   and the limit, rather than sent and refused anonymously.
 */
export function parseApps(apps: string | readonly string[]): {
  owner: string;
  services: string[];
} {
  const list = typeof apps === 'string' ? [apps] : apps;
  if (list.length === 0) {
    throw new BoogyError('invalid_audience_batch', 'connectApp requires at least one app.');
  }

  const parsedApps = list.map(parseApp);
  const owner = parsedApps[0].owner;
  const seen = new Set<string>();
  const services: string[] = [];

  for (const { owner: entryOwner, service } of parsedApps) {
    if (entryOwner !== owner) {
      throw new BoogyError(
        'invalid_audience_batch',
        `"${entryOwner}/${service}" belongs to owner "${entryOwner}", but this batch is for ` +
          `owner "${owner}". A single authorization request may only span one owner's services.`,
        `${entryOwner}/${service}`,
      );
    }
    const audience = `boogy://${entryOwner}/services/${service}`;
    if (!seen.has(audience)) {
      seen.add(audience);
      services.push(service);
    }
  }

  if (services.length > MAX_AUDIENCES) {
    // Report the DISTINCT count — that's the number actually checked against
    // the cap — and additionally name the raw count when it differs, so a
    // caller whose duplicates collapsed isn't left thinking the SDK miscounted.
    const rawCount = list.length;
    const distinctCount = services.length;
    const countPhrase =
      rawCount === distinctCount
        ? `${distinctCount} distinct apps`
        : `${rawCount} apps, ${distinctCount} of them distinct`;
    throw new BoogyError(
      'invalid_audience_batch',
      `connectApp was given ${countPhrase}, but the platform accepts at most ` +
        `${MAX_AUDIENCES} audiences per authorization request.`,
    );
  }

  return { owner, services };
}
