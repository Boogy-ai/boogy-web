// The pane side: what a module calls so a board framing it can show its title,
// know whether it is signed in, and bring it back where the person left it.
//
// Which boards may frame this module is TOLD by the platform (`/boogy/config`'s
// `shellOrigins`), never inferred from `document.referrer` or `window.parent`.
// A module that is never framed, or framed by anything else, simply never
// connects: every report is then a no-op, so the module works exactly as it
// does on its own.

import {
  MAX_HISTORY, PANE_PROTOCOL, fromResultPayload, parseFrame,
  type Frame, type PaneHost, type PaneLastSignIn, type PaneSignInResult,
} from './internal/pane-protocol';
import { exactOrigin, sendFrame, type ExactOrigin } from './internal/pane-messaging';
import { loadPlatformConfig } from './internal/platform-config';
import { setHostZoom, clearHostZoom } from './layout/zoom';

export interface PaneHandle {
  /** Whether this module has a signed-in person. Nothing more: no id, no name. */
  reportAuthState(signedIn: boolean): void;
  /** A title for the board to show instead of the module's address. */
  reportTitle(text: string): void;
  /** Where the module is now, as a path on its own origin, e.g. `/notes/42`.
   *  The board reopens the pane here. It must sit under the module's own
   *  address; anything else is ignored by the board. */
  reportLocation(path: string): void;
  /** Go to `path`, a path on this app's own address — use it instead of
   *  `history.pushState`. In a board, the SDK keeps this pane's history itself
   *  (the address changes without adding browser history, so the browser's
   *  back button leaves the board rather than stepping through the pane) and
   *  the board offers back and forward. Outside a board it is an ordinary
   *  `history.pushState`. Reports the new location either way. The board shows
   *  back and forward only for an app that passes `onNavigate`. With
   *  `{ reset: true }` the pane's history starts afresh at `path` — for a
   *  sign-out, say, after which back must not lead to a signed-in page. */
  navigate(path: string, options?: { reset?: boolean }): void;
  /** Ask the page framing this app to sign it in — call it when the person
   *  chooses to sign in, after reporting signed out (`reportAuthState(false)`):
   *  the page asks nothing of an app that has not said, and tells one that
   *  said it is signed in `'already_signed_in'`. In a frame an app never
   *  signs itself in: the sign-in page refuses to be framed, and the trip must
   *  start and end on the boards origin. So the board framing it makes the
   *  trip, and answers:
   *  - `'leaving'`: it is leaving for sign-in now;
   *  - `'already_signed_in'`: this app last reported itself signed in;
   *  - `{ busy: ms }`: a sign-in went too recently; ask again in `ms`;
   *  - `'unavailable'`: no page framing this app is connected, none answered
   *    within `SIGN_IN_REPLY_TIMEOUT_MS`, or it does not sign apps in.
   *  A request is not kept for later, and asking again before an answer is
   *  the same request. */
  requestSignIn(): Promise<PaneSignInResult>;
  /** Where this app is shown: `'board'`, or `null` until a page framing it
   *  connects, when the page that did said nothing this version knows, or when
   *  it is not framed at all (shown alone, at its own address). */
  readonly host: PaneHost | null;
  /** How the last sign-in the page framing this app made for it ended, when
   *  it came back without signing it in: `'cancelled'` (the person cancelled
   *  it) or `'failed'`; `null` otherwise. A board does not sign an app in
   *  again by itself after such a trip, so an app shows its own "Sign in"
   *  with this beside it. */
  readonly lastSignIn: PaneLastSignIn | null;
  /** Stop listening and reporting. */
  disconnect(): void;
}

export interface ConnectPaneOptions {
  /** This module's service id. */
  service: string;
  /** This app signs people in and tells the board whether it is signed in
   *  (`reportAuthState`). A board then keeps the pane covered until the app
   *  reports signed in, signing it in meanwhile, so the person never sees the
   *  app's own signed-out view while the board is about to sign it in. The
   *  board shows the app as it is only when it cannot sign it in. Leave it out
   *  for an app that does not sign anyone in. */
  signsIn?: boolean;
  /** The board moved this pane back or forward to `path`. The address already
   *  shows it; render it. Only called for history made with `navigate`, and
   *  only an app that passes this is offered back and forward by the board. */
  onNavigate?(path: string): void;
  /** A page framing this app connected, saying where the app is shown (`null`
   *  when it did not say) and how its last sign-in for the app ended when that
   *  did not sign it in (see `PaneHandle.lastSignIn`). Called again whenever
   *  the frame's page connects anew. */
  onConnect?(info: { host: PaneHost | null; lastSignIn: PaneLastSignIn | null }): void;
}

/** How long a sign-in request waits for the page framing the app to answer
 *  before it counts as `'unavailable'`. That page decides at once, or after one
 *  hash of a fresh key, so this only ever runs out on a page that does not
 *  answer at all — and a person who pressed "Sign in" should not wait longer
 *  than this to be told. */
export const SIGN_IN_REPLY_TIMEOUT_MS = 3_000;

type Report = Exclude<
  Frame,
  { type: 'hello' | 'connect' | 'ready' | 'history' | 'zoom' | 'sign-in' | 'sign-in-result' }
>;

/** One pane connection per window. The platform's automatic reporter and the
 *  app's own `connectPane` share this slot, and the app's always wins. */
const PANE_SLOT = Symbol.for('boogy.pane/v1');
interface PaneSlot {
  kind: 'auto' | 'app';
  disconnect(): void;
  requestSignIn(): Promise<PaneSignInResult>;
  reportAuthState(signedIn: boolean): void;
}
type SlotHolder = { [PANE_SLOT]?: PaneSlot };
const holder = (): SlotHolder => globalThis as unknown as SlotHolder;

/** Ask the page framing this window to sign its app in, through whichever
 *  pane connection this window has, first telling it the app is signed out
 *  (the caller has just found that it is). `'unavailable'` when this window has
 *  no pane connection, or the one in the shared slot is not one this SDK can
 *  ask (another copy of it, older or newer, may hold the slot). */
export function requestSignInFromFramer(): Promise<PaneSignInResult> {
  const slot = holder()[PANE_SLOT] as Partial<PaneSlot> | undefined;
  if (typeof slot?.requestSignIn !== 'function' || typeof slot.reportAuthState !== 'function') {
    return Promise.resolve('unavailable');
  }
  slot.reportAuthState(false);
  return slot.requestSignIn();
}

/** Connect the automatic reporter's pane, unless this window already has one.
 *  For the platform's own page script; an app calls `connectPane`. */
export function connectAutoPane(opts: ConnectPaneOptions): PaneHandle | null {
  if (holder()[PANE_SLOT]) return null;
  return connectPaneAs('auto', opts);
}

export function connectPane(opts: ConnectPaneOptions): PaneHandle {
  const held = holder()[PANE_SLOT];
  // The app's own connection replaces the automatic one, which stops answering.
  if (held?.kind === 'auto') held.disconnect();
  return connectPaneAs('app', opts);
}

function connectPaneAs(kind: PaneSlot['kind'], opts: ConnectPaneOptions): PaneHandle {
  let shell: { origin: ExactOrigin; nonce: string; host: PaneHost | null; lastSignIn: PaneLastSignIn | null } | null = null;
  // The sign-in request waiting for its answer, if any: one at a time. `ask`
  // sends it to the shell connected now, with a fresh wait for the answer.
  let pending: { promise: Promise<PaneSignInResult>; settle(r: PaneSignInResult): void; ask(): void } | null = null;
  let live = true;
  // The latest of each report, so a board that connects after the module has
  // already set its title or moved still learns them.
  const latest = new Map<Report['type'], Report['payload']>();

  const send = (type: Report['type'], payload: Report['payload']) => {
    if (!shell) return;
    sendFrame(window.parent, shell.origin, { boogy: PANE_PROTOCOL, type, nonce: shell.nonce, payload } as Frame);
  };
  const report = (type: Report['type'], payload: Report['payload']) => {
    latest.set(type, payload);
    send(type, payload);
  };

  // THIS PANE'S OWN HISTORY, kept when it is in a frame. A frame that pushes
  // browser history adds to its PARENT's too, so a board's back button would
  // walk through the pane instead of leaving the board.
  const framed = window.parent !== window;
  // Only an app that renders a board-driven step keeps its history with the
  // board; any other would show dead buttons, or have its address changed
  // under it without rendering.
  const keepsHistory = framed && typeof opts.onNavigate === 'function';
  const here = () => `${location.pathname}${location.search}${location.hash}`;
  const stack = [here()];
  let index = 0;
  const reportHistory = () =>
    report('history-state', {
      canBack: index > 0,
      canForward: index < stack.length - 1,
      entries: [...stack],
      index,
    });
  if (keepsHistory) reportHistory();

  const step = (delta: -1 | 1) => {
    const next = index + delta;
    if (next < 0 || next >= stack.length) return;
    index = next;
    history.replaceState(history.state, '', stack[index]);
    report('location', { path: stack[index] });
    reportHistory();
    opts.onNavigate?.(stack[index]);
  };

  const onMessage = async (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    if (shell && event.origin === shell.origin) {
      const frame = parseFrame(event.data);
      if (frame && frame.nonce === shell.nonce) {
        if (frame.type === 'history') {
          step(frame.payload.delta);
          return;
        }
        if (frame.type === 'zoom') {
          setHostZoom(frame.payload.factor);
          return;
        }
        if (frame.type === 'sign-in-result') {
          pending?.settle(fromResultPayload(frame.payload));
          return;
        }
      }
    }
    // A connect is admitted exactly when the one validator reads it as one,
    // and only what it kept is used: an optional field it could not read (a
    // host this version does not know — never assumed to be a board — or a
    // size out of bounds) is simply absent, and costs the rest nothing.
    const connect = parseFrame(event.data);
    if (connect?.type !== 'connect') return;
    const offered = connect.payload.shellOrigin;
    if (offered !== event.origin) return;

    let allowed: string[];
    try {
      allowed = (await loadPlatformConfig()).shellOrigins;
    } catch {
      return; // no config, no shell: the module keeps working on its own
    }
    if (!live || !allowed.includes(offered)) return;

    const { host = null, lastSignIn = null, history: handed, zoom } = connect.payload;
    shell = { origin: exactOrigin(offered), nonce: connect.nonce, host, lastSignIn };
    // A history the board hands back (this pane's content moved to this
    // frame): adopted only if this page is its current page, so it can never
    // describe somewhere the pane is not.
    if (keepsHistory && handed && handed.entries[handed.index] === here()) {
      stack.splice(0, stack.length, ...handed.entries);
      index = handed.index;
      reportHistory();
    }
    // The size this board draws the pane at; a board that sends none (or one
    // out of bounds, which the validator drops) leaves it at 1.
    if (zoom !== undefined) setHostZoom(zoom);
    else clearHostZoom();
    sendFrame(window.parent, shell.origin, {
      boogy: PANE_PROTOCOL, type: 'ready', nonce: shell.nonce,
      payload: opts.signsIn ? { service: opts.service, signsIn: true } : { service: opts.service },
    });
    for (const [type, payload] of latest) send(type, payload);
    // A request still waiting was asked of the connection this one replaces,
    // whose answer would carry a nonce no longer heard: ask again here, after
    // the page's state, so the page has heard it first.
    pending?.ask();
    opts.onConnect?.({ host, lastSignIn });
  };

  window.addEventListener('message', onMessage);

  // A board connects a frame when it loads, and an app that starts listening
  // after that would never hear it. So say hello to each board the platform
  // names: the one actually framing this page answers with a fresh connect,
  // and a message aimed at any other origin is dropped by the browser. A page
  // that is not framed has no board to greet, so it says nothing.
  void loadPlatformConfig().then(
    (config) => {
      if (!live || !framed) return;
      for (const origin of config.shellOrigins) {
        try {
          sendFrame(window.parent, exactOrigin(origin), {
            boogy: PANE_PROTOCOL, type: 'hello', nonce: 'hello', payload: { service: opts.service },
          });
        } catch {
          // Not an origin: skip it.
        }
      }
    },
    () => {},
  );

  const handle: PaneHandle = {
    get host() {
      return shell?.host ?? null;
    },
    get lastSignIn() {
      return shell?.lastSignIn ?? null;
    },
    requestSignIn: () => {
      if (pending) return pending.promise;
      if (!shell) return Promise.resolve('unavailable');
      let timer: ReturnType<typeof setTimeout> | undefined;
      let resolve: (r: PaneSignInResult) => void = () => {};
      const promise = new Promise<PaneSignInResult>((r) => { resolve = r; });
      const settle = (r: PaneSignInResult) => {
        clearTimeout(timer);
        if (pending?.promise === promise) pending = null;
        resolve(r);
      };
      // Asked of the shell connected now, which has this long to answer.
      const ask = () => {
        if (!shell) return;
        clearTimeout(timer);
        timer = setTimeout(() => settle('unavailable'), SIGN_IN_REPLY_TIMEOUT_MS);
        sendFrame(window.parent, shell.origin, { boogy: PANE_PROTOCOL, type: 'sign-in', nonce: shell.nonce, payload: {} });
      };
      pending = { promise, settle, ask };
      ask();
      return promise;
    },
    reportAuthState: (signedIn) => report('auth-state', { signedIn }),
    reportTitle: (text) => report('title', { text }),
    reportLocation: (path) => report('location', { path }),
    navigate: (path, options) => {
      if (!framed) {
        history.pushState({}, '', path);
        report('location', { path: here() });
        return;
      }
      // Framed: never add browser history (it would be the board's), whether
      // or not this app keeps its history with the board.
      history.replaceState(history.state, '', path);
      const now = here();
      if (options?.reset) {
        stack.splice(0, stack.length, now);
        index = 0;
      } else if (stack[index] !== now) {
        stack.splice(index + 1, stack.length, now);
        // Bounded: the oldest page goes first.
        if (stack.length > MAX_HISTORY) stack.splice(0, stack.length - MAX_HISTORY);
        index = stack.length - 1;
      }
      report('location', { path: now });
      if (keepsHistory) reportHistory();
    },
    disconnect: () => {
      live = false;
      shell = null;
      pending?.settle('unavailable');
      clearHostZoom();
      window.removeEventListener('message', onMessage);
      if (holder()[PANE_SLOT] === slot) delete holder()[PANE_SLOT];
    },
  };

  const slot: PaneSlot = {
    kind,
    disconnect: () => handle.disconnect(),
    requestSignIn: () => handle.requestSignIn(),
    reportAuthState: (signedIn) => handle.reportAuthState(signedIn),
  };
  holder()[PANE_SLOT] = slot;
  return handle;
}
