// The wire vocabulary for the shell↔pane channel.
//
// One validator, `parseFrame`, is the only way a frame enters either side. It
// checks the version, the type, AND the payload shape — a guard that checks the
// type alone accepts `{ signedIn: 'yes' }`, which is a string check wearing
// validation's clothes.

export const PANE_PROTOCOL = 'pane/v1' as const;

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

function payloadOk(type: PaneMessageType, p: unknown): boolean {
  if (!isRecord(p)) return false;
  switch (type) {
    case 'connect':
      return typeof p.shellOrigin === 'string';
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
      return typeof p.canBack === 'boolean' && typeof p.canForward === 'boolean';
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
