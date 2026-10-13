// Updates for an app's own instance: whether a newer version of it is
// available, and asking the person to move to it.
//
// Inside a board, the board shows a pane's update in its own header and the
// app's Update control asks the board (`requestUpgrade`). Shown alone, the app
// reads the platform's answer for its own address and opens the platform's
// confirmation, which is the only place a person agrees to an update.

import { runUpgradeFlow } from './internal/upgrade-flow';
import { paneConnected, SIGN_IN_REPLY_TIMEOUT_MS, type PaneHandle } from './pane';

/** One thing an update changes, worded by the platform. */
export interface UpdateItem {
  kind: string;
  label: string;
  detail: string | null;
  /** `attention`: the person should look at it before updating. */
  tone: 'attention' | 'info';
}

/** A newer version of the app's instance, which the person may move to. */
export interface Update {
  serviceId: string;
  /** The version running now. */
  current: string;
  /** The version offered. */
  version: string;
  bump: 'major' | 'minor' | 'patch';
  publishedAt: string;
  /** What the author says is new: text, never markup. */
  notes: string | null;
  items: UpdateItem[];
}

const BUMPS = ['major', 'minor', 'patch'];
const isString = (v: unknown): v is string => typeof v === 'string';
const orNull = (v: unknown): string | null => (isString(v) ? v : null);

function readItem(v: unknown): UpdateItem | null {
  const i = v as Record<string, unknown> | null;
  if (!i || !isString(i.kind) || !isString(i.label)) return null;
  return { kind: i.kind, label: i.label, detail: orNull(i.detail), tone: i.tone === 'attention' ? 'attention' : 'info' };
}

/** The platform's answer, as an `Update`; `null` when it holds none. */
function readUpdate(body: unknown): Update | null {
  const b = body as Record<string, unknown> | null;
  const u = b?.update as Record<string, unknown> | null | undefined;
  if (!b || !u || !isString(b.service_id) || !isString(b.current)) return null;
  if (!isString(u.version) || !isString(u.bump) || !BUMPS.includes(u.bump) || !isString(u.published_at)) return null;
  return {
    serviceId: b.service_id,
    current: b.current,
    version: u.version,
    bump: u.bump as Update['bump'],
    publishedAt: u.published_at,
    notes: orNull(u.notes),
    items: Array.isArray(u.items) ? u.items.map(readItem).filter((i): i is UpdateItem => i !== null) : [],
  };
}

/**
 * Whether a newer version of this app's instance is available to the person
 * using it: the update, or `null` when there is none, when the person does not
 * own the instance, or when the check fails.
 *
 * Pass the app's `pane` (from `connectPane`): when the board framing the app
 * shows its update itself (`pane.boardShowsUpdates`), this answers `null`
 * without asking anyone, so the app shows no second update control. In a
 * frame it first waits for the board to connect, at most
 * `SIGN_IN_REPLY_TIMEOUT_MS`, so it can be called straight after
 * `connectPane`; a page shown alone does not wait.
 */
export async function checkForUpdate(opts: { pane?: PaneHandle; fetch?: typeof fetch } = {}): Promise<Update | null> {
  if (opts.pane) await paneConnected(opts.pane, SIGN_IN_REPLY_TIMEOUT_MS);
  if (opts.pane?.boardShowsUpdates) return null;
  const get = opts.fetch ?? globalThis.fetch.bind(globalThis);
  try {
    const res = await get('/boogy/update', { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return readUpdate(await res.json());
  } catch {
    return null;
  }
}

/**
 * Update the app to `update`. In a board that shows updates, asks the board
 * to open its confirmation and resolves what the board did (`'opened'`,
 * `'none'` or `'busy'`). Otherwise opens the platform's confirmation in a
 * window: `'upgraded'` once the person confirmed (the page then reloads, to
 * run the new version) or `'cancelled'`. Rejects `popup_blocked` when the
 * browser blocked the window, or `upgrade_aborted` when it was closed before
 * the person answered; call it from a click.
 */
export async function installUpdate(
  update: Update,
  opts: { pane?: PaneHandle } = {},
): Promise<'opened' | 'upgraded' | 'cancelled' | 'none' | 'busy'> {
  if (opts.pane?.boardShowsUpdates) {
    const asked = await opts.pane.requestUpgrade();
    if (asked !== 'unavailable') return asked;
  }
  const done = await runUpgradeFlow({ serviceId: update.serviceId, to: update.version });
  if (done.outcome === 'upgraded') {
    location.reload();
    return 'upgraded';
  }
  return 'cancelled';
}
