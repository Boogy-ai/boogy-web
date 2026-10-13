import { BoogyError } from '../errors';
import { awaitPopup } from './popup';
import { authOrigin } from './urls';

export interface UpgradeOptions {
  /** The service (the app instance) to move. */
  serviceId: string;
  /** The version to move it to. */
  to: string;
}

export type UpgradeResult = { outcome: 'upgraded'; version: string } | { outcome: 'cancelled' };

export function upgradeUrl(o: UpgradeOptions): string {
  const url = new URL(`${authOrigin()}/boogy/upgrade`);
  url.searchParams.set('service', o.serviceId);
  url.searchParams.set('to', o.to);
  // The asking page's own origin: where the answer is sent.
  url.searchParams.set('app_origin', location.origin);
  url.searchParams.set('mode', 'popup');
  return url.toString();
}

// The upgrade window is one named window, so only one upgrade can be waiting
// on it. A new call supersedes the one before.
let pending: AbortController | null = null;

/**
 * Ask the person, on the platform's own page, to move an app to a newer
 * version. The answer is believed only from the platform's sign-in origin.
 */
export function runUpgradeFlow(o: UpgradeOptions): Promise<UpgradeResult> {
  pending?.abort();
  const mine = new AbortController();
  pending = mine;
  const done = () => { if (pending === mine) pending = null; };
  return awaitPopup<UpgradeResult>({
    signal: mine.signal,
    url: upgradeUrl(o),
    name: 'boogy_upgrade',
    origin: authOrigin(),
    blocked: () => new BoogyError('popup_blocked', 'The update window was blocked by the browser.'),
    aborted: () => new BoogyError('upgrade_aborted', 'The update window was closed before finishing.'),
    decide(data) {
      const d = data as { boogy?: unknown; version?: unknown } | null;
      if (d?.boogy === 'upgrade_done' && typeof d.version === 'string') {
        return { value: { outcome: 'upgraded', version: d.version } };
      }
      if (d?.boogy === 'upgrade_cancelled') return { value: { outcome: 'cancelled' } };
      return null;
    },
  }).finally(done);
}
