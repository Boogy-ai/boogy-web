// The wire vocabulary for the shell↔pane channel.
//
// One validator, `parseFrame`, is the only way a frame enters either side. It
// checks the version, the type, AND the payload shape — a guard that checks the
// type alone accepts `{ signedIn: 'yes' }`, which is a string check wearing
// validation's clothes.

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
  | 'history-state';

export interface Envelope<T extends PaneMessageType, P> {
  boogy: typeof PANE_PROTOCOL;
  type: T;
  /** Minted by the shell at handshake; echoed on every frame thereafter. */
  nonce: string;
  payload: P;
}

export interface ConnectPayload {
  /** The origin the shell claims to be. The pane verifies it; it never trusts it. */
  shellOrigin: string;
  /** The pane's history, handed back after its content moved to this frame.
   *  The pane adopts it only if it is on the history's current page. */
  history?: PaneHistory;
}
/** `hello` (pane → board: "I am listening now") and `ready` both name the service. */
export interface ReadyPayload {
  service: string;
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

export type Frame =
  | Envelope<'hello', ReadyPayload>
  | Envelope<'connect', ConnectPayload>
  | Envelope<'ready', ReadyPayload>
  | Envelope<'auth-state', AuthStatePayload>
  | Envelope<'title', TitlePayload>
  | Envelope<'location', LocationPayload>
  | Envelope<'history', HistoryPayload>
  | Envelope<'history-state', HistoryStatePayload>;

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

function payloadOk(type: PaneMessageType, p: unknown): boolean {
  if (!isRecord(p)) return false;
  switch (type) {
    case 'connect':
      if (typeof p.shellOrigin !== 'string') return false;
      if (p.history === undefined) return true;
      return isRecord(p.history) && historyOk(p.history.entries, p.history.index);
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
];

/** The single entry point for an inbound frame. `null` means "not ours". */
export function parseFrame(data: unknown): Frame | null {
  if (!isRecord(data)) return null;
  if (data.boogy !== PANE_PROTOCOL) return null;
  if (typeof data.nonce !== 'string' || data.nonce.length === 0) return null;
  const type = data.type;
  if (typeof type !== 'string') return null;
  if (!TYPES.includes(type as PaneMessageType)) return null;
  if (!payloadOk(type as PaneMessageType, data.payload)) return null;
  return data as unknown as Frame;
}
