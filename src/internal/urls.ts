import { BoogyError } from '../errors';

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

/** Build the per-owner app origin: 'https://<owner>.<base>' */
export function appOrigin(owner: string, base: string): string {
  return `https://${owner}.${base}`;
}

/** Build the auth subdomain origin: 'https://auth.<base>' */
export function authOrigin(base: string): string {
  return `https://auth.${base}`;
}

/**
 * Build the full `/authorize` URL on the auth subdomain.
 * Query parameters: aud, app_origin, redirect, state, code_challenge, mode.
 */
export function authorizeUrl(p: {
  base: string;
  owner: string;
  service: string;
  redirect: string;
  state: string;
  codeChallenge: string;
  mode: 'popup' | 'redirect';
}): string {
  const url = new URL(`${authOrigin(p.base)}/authorize`);
  url.searchParams.set('aud', `boogy://${p.owner}/services/${p.service}`);
  url.searchParams.set('app_origin', appOrigin(p.owner, p.base));
  url.searchParams.set('redirect', p.redirect);
  url.searchParams.set('state', p.state);
  url.searchParams.set('code_challenge', p.codeChallenge);
  url.searchParams.set('mode', p.mode);
  return url.toString();
}
