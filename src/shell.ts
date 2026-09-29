// The board side: what a board calls to hear from the modules it frames — their
// titles, where each one is, and whether each is signed in.
//
// Every pane on a board belongs to the board's owner, so they all share one
// origin. `event.origin` therefore names the owner and cannot say which pane
// spoke: a frame is attributed by `event.source`, matched against a registered
// iframe's window, and must also come from that pane's origin and carry the
// nonce of the page the board connected. A module can still speak for its
// origin-mates; that is inherent in the addressing and cannot be closed here.
//
// Everything a pane reports is a request: a location outside the pane's own
// address is dropped, and a title is trimmed and capped before it is shown.

import { PANE_PROTOCOL, parseFrame, type Frame, type PaneHistory } from './internal/pane-protocol';
import { exactOrigin, sendFrame, receiveFrames, type ExactOrigin } from './internal/pane-messaging';
import { isRestorablePath } from './internal/pane-paths';

/** The longest title a board shows for a pane. */
export const MAX_TITLE_LENGTH = 120;

export interface PaneRegistration {
  /** The board's own id for this pane. */
  id: string;
  /** The module's service id. */
  service: string;
  /** The origin the pane is served from, e.g. `https://tester.boogy.app`. */
  origin: string;
  /** The pane's address on that origin, e.g. `/notes`; bounds a reported location. */
  mount: string;
  /** The app's own history, when its content was in another frame before
   *  (the board kept it from `onHistoryState`): handed to the app on connect. */
  history?: PaneHistory;
}

export interface ShellEvents {
  /** The pane speaks the protocol, and names the service it believes it is. */
  onReady(id: string, service: string): void;
  onAuthState(id: string, signedIn: boolean): void;
  onTitle(id: string, text: string): void;
  /** A path under the pane's own address, safe to reopen the pane at. */
  onLocation(id: string, path: string): void;
  /** Whether the pane can go back or forward in its own history now, and the
   *  history itself (every entry under the pane's address), for the board to
   *  keep with the pane's content and pass back as `history` if it moves. */
  onHistoryState(id: string, canBack: boolean, canForward: boolean, history?: PaneHistory): void;
}

export interface Shell {
  /** Start talking to a pane. Register before or after it loads: every load is connected. */
  registerPane(iframe: HTMLIFrameElement, pane: PaneRegistration): void;
  unregisterPane(id: string): void;
  /** Ask a pane to go back, or forward, in its own history. */
  back(id: string): void;
  forward(id: string): void;
  destroy(): void;
}

interface Entry {
  pane: PaneRegistration;
  iframe: HTMLIFrameElement;
  exact: ExactOrigin;
  onLoad(): void;
  off(): void;
  offHello(): void;
  /** The nonce of the page connected now; empty before any connect. */
  nonce: string;
  /** The latest history this pane reported (or was registered with). */
  history?: PaneHistory;
}

// Direction and isolation marks (which can reorder what the header shows) and
// control characters are not part of a title.
const UNSHOWABLE = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

function cleanTitle(text: string): string {
  return [...text.replace(UNSHOWABLE, '').trim()].slice(0, MAX_TITLE_LENGTH).join('');
}

/** A history the board may keep or hand back: every entry must be a page the
 *  pane could legitimately be reopened at. */
function usableHistory(h: PaneHistory | undefined, mount: string): PaneHistory | undefined {
  if (!h || !h.entries.every((e) => isRestorablePath(e, mount))) return undefined;
  return { entries: [...h.entries], index: h.index };
}

function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createShell(events: Partial<ShellEvents>): Shell {
  const panes = new Map<string, Entry>();

  const handle = (entry: Entry, frame: Frame) => {
    const pane = entry.pane;
    switch (frame.type) {
      case 'ready':
        events.onReady?.(pane.id, frame.payload.service);
        return;
      case 'auth-state':
        events.onAuthState?.(pane.id, frame.payload.signedIn);
        return;
      case 'title': {
        const text = cleanTitle(frame.payload.text);
        if (text) events.onTitle?.(pane.id, text);
        return;
      }
      case 'location':
        if (isRestorablePath(frame.payload.path, pane.mount)) events.onLocation?.(pane.id, frame.payload.path);
        return;
      case 'history-state': {
        const { canBack, canForward, entries, index } = frame.payload;
        const history = entries && index !== undefined ? usableHistory({ entries, index }, pane.mount) : undefined;
        if (history) entry.history = history;
        events.onHistoryState?.(pane.id, canBack, canForward, history);
        return;
      }
      default:
        return; // hello is handled per pane; connect and history are board → pane
    }
  };

  const remove = (id: string) => {
    const entry = panes.get(id);
    if (!entry) return;
    entry.off();
    entry.offHello();
    entry.iframe.removeEventListener('load', entry.onLoad);
    panes.delete(id);
  };

  const move = (id: string, delta: -1 | 1) => {
    const entry = panes.get(id);
    const target = entry?.iframe.contentWindow;
    if (!entry || !target || !entry.nonce) return;
    sendFrame(target as Window, entry.exact, {
      boogy: PANE_PROTOCOL, type: 'history', nonce: entry.nonce, payload: { delta },
    });
  };

  return {
    registerPane(iframe, pane) {
      remove(pane.id);
      const exact = exactOrigin(pane.origin);
      const entry: Entry = {
        pane, iframe, exact, onLoad: () => {}, off: () => {}, offHello: () => {}, nonce: '',
        history: usableHistory(pane.history, pane.mount),
      };

      // Each page the frame loads gets its own nonce; a frame from the page
      // before is stale and dropped.
      const connect = () => {
        const target = iframe.contentWindow;
        if (!target) return;
        const nonce = newNonce();
        entry.nonce = nonce;
        entry.off();
        entry.off = receiveFrames(window, {
          nonce,
          isAllowedSource: (s) => s === target,
          onFrame: (frame, event) => {
            if (event.origin !== pane.origin) return;
            handle(entry, frame);
          },
        });
        sendFrame(target as Window, exact, {
          boogy: PANE_PROTOCOL,
          type: 'connect',
          nonce,
          payload: entry.history
            ? { shellOrigin: window.location.origin, history: entry.history }
            : { shellOrigin: window.location.origin },
        });
      };

      entry.onLoad = connect;
      iframe.addEventListener('load', connect);
      // A pane that started listening after its page loaded says hello; answer
      // it with a fresh connect. It carries no nonce yet, so it is taken only
      // from this pane's own window and origin.
      const onHello = (event: MessageEvent) => {
        if (event.source !== iframe.contentWindow || event.origin !== pane.origin) return;
        if (parseFrame(event.data)?.type === 'hello') connect();
      };
      window.addEventListener('message', onHello);
      entry.offHello = () => window.removeEventListener('message', onHello);
      panes.set(pane.id, entry);
      connect();
    },

    unregisterPane: remove,

    back: (id) => move(id, -1),
    forward: (id) => move(id, 1),

    destroy() {
      for (const id of [...panes.keys()]) remove(id);
    },
  };
}
