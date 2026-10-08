// The wire vocabulary for the shell↔pane channel.
//
// One validator, `parseFrame`, is the only way a frame enters either side. It
// checks the version, the type, AND the payload shape — a guard that checks the
// type alone accepts `{ signedIn: 'yes' }`, which is a string check wearing
// validation's clothes.

import { isZoomFactor } from '../layout/zoom';

export const PANE_PROTOCOL = 'pane/v1' as const;

/** The most history entries a pane keeps and a board hands back. */
export const MAX_HISTORY = 50;

/** A pane's own history: its pages, oldest first, and where it is in them. */
export interface PaneHistory {
  entries: string[];
  index: number;
}

export type PaneMessageType =
  | 'hello'
  | 'connect'
  | 'ready'
  | 'auth-state'
  | 'title'
  | 'location'
  | 'history'
  | 'history-state'
  | 'zoom'
  | 'sign-in'
  | 'sign-in-result';

/** Where an app is shown when it is framed: in a board, beside other apps. An
 *  app shown alone is at its own address, unframed, so no page frames it
 *  alone. */
export type PaneHost = 'board';

const HOSTS: readonly PaneHost[] = ['board'];

/** How the last sign-in trip a page made for the app ended, when it came back
 *  without signing the app in: `'cancelled'` (the person cancelled it) or
 *  `'failed'` (it did not finish for this app). */
export type PaneLastSignIn = 'cancelled' | 'failed';

const LAST_SIGN_INS: readonly PaneLastSignIn[] = ['cancelled', 'failed'];

/** What became of a pane's request to sign in:
 *  - `'leaving'`: the page framing the app is leaving for sign-in now;
 *  - `'already_signed_in'`: the app last reported itself signed in;
 *  - `{ busy: ms }`: a sign-in trip went too recently; ask again in `ms`;
 *  - `'unavailable'`: no page framing the app can sign it in (none connected,
 *    none answered, or it does not sign apps in). */
export type PaneSignInResult = 'leaving' | 'already_signed_in' | 'unavailable' | { busy: number };

/** The longest wait a `busy` answer may name. */
export const MAX_SIGN_IN_WAIT_MS = 3_600_000;

export interface Envelope<T extends PaneMessageType, P> {
  boogy: typeof PANE_PROTOCOL;
  type: T;
  /** Minted by the shell at handshake; echoed on every frame thereafter. */
  nonce: string;
  payload: P;
}

/** A connect's OPTIONAL fields never decide whether it is one: `parseFrame`
 *  keeps each it can read and drops the rest, so an app always connects to a
 *  page it may talk to, and uses exactly what was kept. Only `shellOrigin` is
 *  required. */
export interface ConnectPayload {
  /** The origin the shell claims to be. The pane verifies it; it never trusts it. */
  shellOrigin: string;
  /** Where the app is shown, so it can word what it says about signing in.
   *  Absent from a page that does not say, or names a place this version does
   *  not know: the app then does not know. */
  host?: PaneHost;
  /** How the last sign-in this page made for the app ended, when it came back
   *  without signing it in. Absent otherwise. */
  lastSignIn?: PaneLastSignIn;
  /** The pane's history, handed back after its content moved to this frame.
   *  The pane adopts it only if it is on the history's current page. */
  history?: PaneHistory;
  /** The size the board draws this pane at (its override, or the board's); absent means 1. */
  zoom?: number;
}
/** `hello` (pane → board: "I am listening now") and `ready` both name the service. */
export interface ReadyPayload {
  service: string;
  /** `ready` only: the app signs people in, so a board keeps its pane covered
   *  until it reports signed in (see `ConnectPaneOptions.signsIn`). Absent is
   *  no. */
  signsIn?: boolean;
}
export interface AuthStatePayload {
  signedIn: boolean;
}
export interface TitlePayload {
  text: string;
}
export interface LocationPayload {
  path: string;
}
/** Board → pane: move one step back (-1) or forward (1) in the pane's own history. */
export interface HistoryPayload {
  delta: -1 | 1;
}
/** Pane → board: whether a step back or forward is possible now. */
export interface HistoryStatePayload {
  canBack: boolean;
  canForward: boolean;
  /** The whole history, so a board can hand it back if the pane moves. */
  entries?: string[];
  index?: number;
}

/** Board → pane: draw at this size (the zoom store's host value). */
export interface ZoomPayload {
  factor: number;
}

/** Pane → shell: the person chose to sign in. It names nothing: the shell
 *  signs in the one app it registered for this pane, never one the pane names. */
export type SignInPayload = Record<string, never>;

/** Shell → pane: what became of its sign-in request ([`PaneSignInResult`] on
 *  the wire); `retryAfterMs` only with `busy`. */
export interface SignInResultPayload {
  outcome: 'leaving' | 'already_signed_in' | 'unavailable' | 'busy';
  retryAfterMs?: number;
}

export type Frame =
  | Envelope<'hello', ReadyPayload>
  | Envelope<'connect', ConnectPayload>
  | Envelope<'ready', ReadyPayload>
  | Envelope<'auth-state', AuthStatePayload>
  | Envelope<'title', TitlePayload>
  | Envelope<'location', LocationPayload>
  | Envelope<'history', HistoryPayload>
  | Envelope<'history-state', HistoryStatePayload>
  | Envelope<'zoom', ZoomPayload>
  | Envelope<'sign-in', SignInPayload>
  | Envelope<'sign-in-result', SignInResultPayload>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function historyOk(entries: unknown, index: unknown): boolean {
  return (
    Array.isArray(entries) &&
    entries.length > 0 &&
    entries.length <= MAX_HISTORY &&
    entries.every((e) => typeof e === 'string') &&
    Number.isInteger(index) &&
    (index as number) >= 0 &&
    (index as number) < entries.length
  );
}

/** A whole number of milliseconds a `busy` answer may name. */
export function isSignInWait(ms: unknown): ms is number {
  return Number.isInteger(ms) && (ms as number) > 0 && (ms as number) <= MAX_SIGN_IN_WAIT_MS;
}

/** The wire form of a result, and back. */
export function toResultPayload(r: PaneSignInResult): SignInResultPayload {
  return typeof r === 'object' ? { outcome: 'busy', retryAfterMs: r.busy } : { outcome: r };
}
export function fromResultPayload(p: SignInResultPayload): PaneSignInResult {
  return p.outcome === 'busy' ? { busy: p.retryAfterMs as number } : p.outcome;
}

/** A connect's payload, keeping what it can read: `null` only without a
 *  `shellOrigin`. See [`ConnectPayload`]. */
function connectPayload(p: unknown): ConnectPayload | null {
  if (!isRecord(p) || typeof p.shellOrigin !== 'string') return null;
  const out: ConnectPayload = { shellOrigin: p.shellOrigin };
  if (HOSTS.includes(p.host as PaneHost)) out.host = p.host as PaneHost;
  if (LAST_SIGN_INS.includes(p.lastSignIn as PaneLastSignIn)) out.lastSignIn = p.lastSignIn as PaneLastSignIn;
  if (isRecord(p.history) && historyOk(p.history.entries, p.history.index)) {
    out.history = { entries: [...(p.history.entries as string[])], index: p.history.index as number };
  }
  if (isZoomFactor(p.zoom)) out.zoom = p.zoom as number;
  return out;
}

function payloadOk(type: PaneMessageType, p: unknown): boolean {
  if (!isRecord(p)) return false;
  switch (type) {
    case 'connect':
      return connectPayload(p) !== null;
    case 'hello':
    case 'ready':
      return typeof p.service === 'string';
    case 'auth-state':
      return typeof p.signedIn === 'boolean';
    case 'title':
      return typeof p.text === 'string';
    case 'location':
      return typeof p.path === 'string';
    case 'history':
      return p.delta === -1 || p.delta === 1;
    case 'history-state':
      if (typeof p.canBack !== 'boolean' || typeof p.canForward !== 'boolean') return false;
      if (p.entries === undefined && p.index === undefined) return true;
      return historyOk(p.entries, p.index);
    case 'zoom':
      return isZoomFactor(p.factor);
    case 'sign-in':
      return Object.keys(p).length === 0;
    case 'sign-in-result':
      if (p.outcome === 'busy') return isSignInWait(p.retryAfterMs);
      return (
        (p.outcome === 'leaving' || p.outcome === 'already_signed_in' || p.outcome === 'unavailable') &&
        p.retryAfterMs === undefined
      );
  }
}

const TYPES: readonly PaneMessageType[] = [
  'hello',
  'connect',
  'ready',
  'auth-state',
  'title',
  'location',
  'history',
  'history-state',
  'zoom',
  'sign-in',
  'sign-in-result',
];

/** The single entry point for an inbound frame. `null` means "not ours". A
 *  connect comes back with only the optional fields that could be read. */
export function parseFrame(data: unknown): Frame | null {
  if (!isRecord(data)) return null;
  if (data.boogy !== PANE_PROTOCOL) return null;
  if (typeof data.nonce !== 'string' || data.nonce.length === 0) return null;
  const type = data.type;
  if (typeof type !== 'string') return null;
  if (!TYPES.includes(type as PaneMessageType)) return null;
  if (!payloadOk(type as PaneMessageType, data.payload)) return null;
  if (type === 'connect') return { ...data, payload: connectPayload(data.payload) } as unknown as Frame;
  return data as unknown as Frame;
}
