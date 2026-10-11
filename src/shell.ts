// The framing side: what a board — or the platform's page framing one app at
// its own address — calls to hear from the apps it frames: their titles, where
// each one is, whether each is signed in, and when one asks to be signed in.
//
// A frame is attributed by `event.source`, matched against a registered
// iframe's window, and must also come from that pane's registered origin and
// carry the nonce of the page the shell connected. Each app runs on an origin
// of its own, bound to one service, and a pane's `ready` is checked against the
// service it was registered as; until it matches, nothing the page says about
// signing in is heard.
//
// Everything a pane reports is a request: a location outside the pane's own
// address is dropped, and a title is trimmed and capped before it is shown.

import {
  PANE_PROTOCOL, isSignInWait, parseFrame, toResultPayload,
  type Frame, type PaneHistory, type PaneHost, type PaneScheme, type PaneLastSignIn, type PaneSignInResult,
} from './internal/pane-protocol';
import { exactOrigin, sendFrame, receiveFrames, type ExactOrigin } from './internal/pane-messaging';
import { isRestorablePath } from './internal/pane-paths';
import { ZOOM_MIN, ZOOM_MAX } from './layout/zoom';

/** The longest title a board shows for a pane. */
export const MAX_TITLE_LENGTH = 120;

/**
 * The `sandbox` of a frame holding an app from its own origin — ONE grant for
 * every app a board frames, so an app behaves the same in any board. Its own
 * origin is unique to it, so `allow-same-origin` reaches only the app's own
 * storage. On top of scripts and forms: downloads, dialogs (`alert`,
 * `confirm`), and popups that are real windows — where anything outside the
 * app goes (an OAuth consent, a payment page, "open elsewhere"), with
 * `target="_blank"`.
 *
 * NO top-level navigation of any kind, a click's included: an app able to
 * navigate the page framing it could swap a board for a look-alike sign-in
 * page. Signing the app in is the framing page's job (`requestSignIn`).
 */
export const PANE_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox ' +
  'allow-downloads allow-modals';

/**
 * How long after a sign-in trip for an app leaves, and again after the page
 * comes back from it (signed in or not), before another may go for that app.
 * It is what bounds an app that asks on every load: such an app goes round at
 * most once per cooldown plus the trip itself (a few seconds), so fewer than
 * four times a minute, slowly enough for the person to see what is happening
 * and leave. It is short enough that a person who signs out just after signing
 * in waits at most this long, and the app is told how long (`{ busy: ms }`).
 * A page that frames apps and signs them in uses this figure.
 */
export const TRIP_COOLDOWN_MS = 15_000;

export interface PaneRegistration {
  /** The board's own id for this pane. */
  id: string;
  /** The module's service id. Required: a pane registered with none is never
   *  connected, since what it says about itself could not be checked. */
  service: string;
  /** The origin the pane is served from: the app's own address, e.g.
   *  `https://notes-k3v9.boogy.app`. */
  origin: string;
  /** The app's own history, when its content was in another frame before
   *  (the board kept it from `onHistoryState`): handed to the app on connect. */
  history?: PaneHistory;
  /** How the last sign-in trip this page made for the app ended, when it came
   *  back without signing it in — told to the app on every connect, so it can
   *  say so beside its own "Sign in". Register the pane again to change it. */
  lastSignIn?: PaneLastSignIn;
}

export interface ShellEvents {
  /** The pane speaks the protocol, and names the service it believes it is,
   *  and whether its app signs people in (`ConnectPaneOptions.signsIn`; only a
   *  plain `true` counts) and whether it drew no page background, so the
   *  board's shows through it (only a plain `'board'` counts). */
  onReady(id: string, service: string, info: { signsIn: boolean; boardBackground: boolean }): void;
  /** A pane reported a service other than the one registered for it. The
   *  frame is not that app: nothing more from that page is acted on, until
   *  its frame loads another page. */
  onServiceMismatch?(id: string, reported: string): void;
  onAuthState(id: string, signedIn: boolean): void;
  onTitle(id: string, text: string): void;
  /** A path under the pane's own address, safe to reopen the pane at. */
  onLocation(id: string, path: string): void;
  /** Whether the pane can go back or forward in its own history now, and the
   *  history itself (every entry under the pane's address), for the board to
   *  keep with the pane's content and pass back as `history` if it moves. */
  onHistoryState(id: string, canBack: boolean, canForward: boolean, history?: PaneHistory): void;
  /** The pane's app asked to be signed in: the person chose to sign in there.
   *  Heard only from the pane's own frame and origin, on the page this shell
   *  connected, once that page named the service registered for it and last
   *  reported itself signed OUT (a page that has not reported is answered
   *  `'unavailable'`, one that reported signed in `'already_signed_in'`,
   *  without asking). Sign in that registered app — the request names nothing —
   *  and limit how often: an app can ask as often as it likes. Return what
   *  became of it, now or later; the shell sends that back to the page. */
  onSignInRequested(id: string): PaneSignInResult | Promise<PaneSignInResult>;
}

export interface ShellOptions {
  /** What this page is to the apps it frames, told to each in its connect:
   *  `board`, the default and the only one — an app shown alone is at its own
   *  address, unframed. */
  host?: PaneHost;
  /** The scheme this page is drawn in, told to each pane on connect. Absent:
   *  not said. */
  scheme?: PaneScheme;
}

export interface Shell {
  /** Start talking to a pane. Register before or after it loads: every load is connected. */
  registerPane(iframe: HTMLIFrameElement, pane: PaneRegistration): void;
  unregisterPane(id: string): void;
  /** Ask a pane to go back, or forward, in its own history. */
  back(id: string): void;
  forward(id: string): void;
  /** The board-wide zoom: sent to every pane that has no override of its own. */
  setZoom(factor: number): void;
  /** One pane's zoom, outranking the board's; `null` makes it follow the board again. */
  setPaneZoom(id: string, factor: number | null): void;
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
  /** Set on a service mismatch: this page is not reconnected — no `hello`
   *  answered, no `connect` sent — until its FRAME loads a new page. */
  refused: boolean;
  /** Whether the page connected now has named the service registered for
   *  this pane. Cleared on every connect: each page names itself. */
  ready: boolean;
  /** What the page connected now last said about being signed in; null until
   *  it says. Cleared on every connect: each page reports for itself. */
  signedIn: boolean | null;
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
function usableHistory(h: PaneHistory | undefined): PaneHistory | undefined {
  if (!h || !h.entries.every((e) => isRestorablePath(e))) return undefined;
  return { entries: [...h.entries], index: h.index };
}

/** `r` if it is a result a pane can be sent, `'unavailable'` otherwise. */
function usableResult(r: unknown): PaneSignInResult {
  if (r === 'leaving' || r === 'already_signed_in' || r === 'unavailable') return r;
  if (typeof r === 'object' && r !== null && isSignInWait((r as { busy?: unknown }).busy)) {
    return { busy: (r as { busy: number }).busy };
  }
  return 'unavailable';
}

function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createShell(events: Partial<ShellEvents>, options: ShellOptions = {}): Shell {
  const panes = new Map<string, Entry>();
  const host: PaneHost = options.host ?? 'board';
  const scheme = options.scheme;

  // The board's zoom and each pane's override. Overrides are kept by pane id,
  // apart from the registration, so a pane registered again keeps its own.
  let boardZoom = 1;
  const overrides = new Map<string, number>();
  const clampZoom = (f: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, f));
  const zoomFor = (id: string) => overrides.get(id) ?? boardZoom;
  const sendZoom = (entry: Entry) => {
    const target = entry.iframe.contentWindow;
    if (!target || !entry.nonce) return;
    sendFrame(target as Window, entry.exact, {
      boogy: PANE_PROTOCOL, type: 'zoom', nonce: entry.nonce, payload: { factor: zoomFor(entry.pane.id) },
    });
  };

  const handle = (entry: Entry, frame: Frame) => {
    const pane = entry.pane;
    switch (frame.type) {
      case 'ready':
        if (frame.payload.service !== pane.service) {
          events.onServiceMismatch?.(pane.id, frame.payload.service);
          entry.refused = true;
          entry.ready = false;
          entry.off();
          return;
        }
        entry.ready = true;
        events.onReady?.(pane.id, frame.payload.service, {
          signsIn: frame.payload.signsIn === true,
          boardBackground: frame.payload.background === 'board',
        });
        return;
      case 'sign-in':
        answerSignIn(entry);
        return;
      case 'auth-state':
        // Only from a page that has said which app it is, and been believed.
        if (!entry.ready) return;
        entry.signedIn = frame.payload.signedIn;
        events.onAuthState?.(pane.id, frame.payload.signedIn);
        return;
      case 'title': {
        const text = cleanTitle(frame.payload.text);
        if (text) events.onTitle?.(pane.id, text);
        return;
      }
      case 'location':
        if (isRestorablePath(frame.payload.path)) events.onLocation?.(pane.id, frame.payload.path);
        return;
      case 'history-state': {
        const { canBack, canForward, entries, index } = frame.payload;
        const history = entries && index !== undefined ? usableHistory({ entries, index }) : undefined;
        if (history) entry.history = history;
        events.onHistoryState?.(pane.id, canBack, canForward, history);
        return;
      }
      default:
        return; // hello is handled per pane; connect and history are board → pane
    }
  };

  // A sign-in request: decided here when the page may not ask, by the caller
  // otherwise, and answered to the page that asked — never to a page the frame
  // has loaded since, which did not ask.
  const answerSignIn = (entry: Entry) => {
    const nonce = entry.nonce;
    const reply = (result: PaneSignInResult) => {
      const target = entry.iframe.contentWindow;
      if (panes.get(entry.pane.id) !== entry || entry.nonce !== nonce || !target) return;
      sendFrame(target as Window, entry.exact, {
        boogy: PANE_PROTOCOL, type: 'sign-in-result', nonce, payload: toResultPayload(result),
      });
    };
    // Only a page that has said which app it is, been believed, and said it is
    // signed out.
    if (!entry.ready || entry.signedIn === null) return reply('unavailable');
    if (entry.signedIn) return reply('already_signed_in');
    const decide = events.onSignInRequested;
    if (!decide) return reply('unavailable');
    let decided: PaneSignInResult | Promise<PaneSignInResult>;
    try {
      decided = decide(entry.pane.id);
    } catch {
      return reply('unavailable');
    }
    void Promise.resolve(decided).then(
      (r) => reply(usableResult(r)),
      () => reply('unavailable'),
    );
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
      // No service, nothing to check a pane's `ready` against: such a pane is
      // never connected, so nothing it says is ever heard.
      if (!pane.service) {
        console.warn(`[boogy] pane ${pane.id} was registered with no service; it is not connected`);
        return;
      }
      const exact = exactOrigin(pane.origin);
      const entry: Entry = {
        pane, iframe, exact, onLoad: () => {}, off: () => {}, offHello: () => {}, nonce: '', refused: false,
        ready: false, signedIn: null, history: usableHistory(pane.history),
      };

      // Each page the frame loads gets its own nonce; a frame from the page
      // before is stale and dropped. A REFUSED page (a service mismatch) is
      // never reconnected — see `onLoad`/`onHello` below for the one way out.
      const connect = () => {
        if (entry.refused) return;
        const target = iframe.contentWindow;
        if (!target) return;
        const nonce = newNonce();
        entry.nonce = nonce;
        entry.ready = false;
        entry.signedIn = null;
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
          payload: {
            shellOrigin: window.location.origin,
            host,
            ...(pane.lastSignIn ? { lastSignIn: pane.lastSignIn } : {}),
            ...(entry.history ? { history: entry.history } : {}),
            ...(zoomFor(pane.id) !== 1 ? { zoom: zoomFor(pane.id) } : {}),
            ...(scheme ? { scheme } : {}),
          },
        });
      };

      // A new page in this frame gets a fresh chance even if the one before
      // it was refused — clear the flag here, the ONE place that does, before
      // reconnecting.
      const onLoad = () => {
        entry.refused = false;
        connect();
      };
      entry.onLoad = onLoad;
      iframe.addEventListener('load', onLoad);
      // A pane that started listening after its page loaded says hello; answer
      // it with a fresh connect. It carries no nonce yet, so it is taken only
      // from this pane's own window and origin. A refused page's hello is
      // ignored — `connect()` already no-ops while refused, checked here too
      // so a refused page's hello doesn't even pay for `parseFrame`.
      const onHello = (event: MessageEvent) => {
        if (entry.refused) return;
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

    setZoom(factor) {
      if (!Number.isFinite(factor)) return;
      const next = clampZoom(factor);
      if (next === boardZoom) return;
      boardZoom = next;
      for (const entry of panes.values()) if (!overrides.has(entry.pane.id)) sendZoom(entry);
    },

    setPaneZoom(id, factor) {
      if (factor === null) {
        if (!overrides.delete(id)) return;
      } else {
        if (!Number.isFinite(factor)) return;
        overrides.set(id, clampZoom(factor));
      }
      const entry = panes.get(id);
      if (entry) sendZoom(entry);
    },

    destroy() {
      for (const id of [...panes.keys()]) remove(id);
      overrides.clear();
    },
  };
}
