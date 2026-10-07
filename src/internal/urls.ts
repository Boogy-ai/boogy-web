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
 * The origin that serves `owner/service`, as seen from this page.
 *
 * Every service is served at the root of its own address, a label the
 * platform allocates when it is deployed (`notes-k3v9` in
 * `https://notes-k3v9.boogy.app`). The label is not derived from anything this
 * page knows — a service's owner and id do not name it — so this page can only
 * name an origin it is on:
 *
 * - **On a service's own label** (the platform config names its one service),
 *   that service's origin is this page's own, and no other app is served here.
 * - **Any other app** throws `BoogyError('app_not_found')`, naming it, rather
 *   than addressing a request to this origin, where it would reach this
 *   origin's own service instead, or composing an address it cannot know. An
 *   origin that names no service serves none, so every app is refused there.
 *
 * Throws (via `platformConfig()`) if config was never loaded — there is no
 * hostname-derived fallback.
 */
export function appOrigin(owner: string, service: string): string {
  const config = platformConfig();
  const here = config.owner === owner && config.service === service;
  if (here) return location.origin;
  throw new BoogyError(
    'app_not_found',
    `"${owner}/${service}" is not served here: ` +
      (config.service === undefined
        ? 'this origin names no service.'
        : `this origin serves only "${config.owner}/${config.service}".`) +
      ' Another app is at an address of its own, which the platform allocates and this page cannot work out.',
    `${owner}/${service}`,
  );
}

/**
 * Where `owner/service`'s routes start, as seen from this page: its origin,
 * since every service is served at the root of its own address — never a path
 * under it. Refused as `appOrigin` refuses.
 */
export function appBaseUrl(owner: string, service: string): string {
  return appOrigin(owner, service);
}

/**
 * Build the auth origin — where `/authorize` and `/_agents/*` are served.
 *
 * Read from `platformConfig().authOrigin`, never derived from this page's
 * own hostname: the auth origin lives on a different registrable domain than
 * a service's own address in production, and guessing it from the URL bar is
 * exactly the defect `platformConfig()` exists to remove. Throws if config
 * was never loaded or failed to load — there is no fallback. On an origin
 * where the platform has no config to give (`/boogy/config` answers 404),
 * `loadPlatformConfig()` rejects and this throws too; that is the intended,
 * honest failure, not a bug to work around with a hostname-derived guess.
 */
export function authOrigin(): string {
  return platformConfig().authOrigin;
}
