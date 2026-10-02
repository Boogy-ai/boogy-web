// The pane side: what a module calls so a board framing it can show its title,
// know whether it is signed in, and bring it back where the person left it.
//
// Which boards may frame this module is TOLD by the platform (`/boogy/config`'s
// `shellOrigins`), never inferred from `document.referrer` or `window.parent`.
// A module that is never framed, or framed by anything else, simply never
// connects: every report is then a no-op, so the module works exactly as it
// does on its own.

import { MAX_HISTORY, PANE_PROTOCOL, parseFrame, type Frame } from './internal/pane-protocol';
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
  /** Stop listening and reporting. */
  disconnect(): void;
}

export interface ConnectPaneOptions {
  /** This module's service id. */
  service: string;
  /** The board moved this pane back or forward to `path`. The address already
   *  shows it; render it. Only called for history made with `navigate`, and
   *  only an app that passes this is offered back and forward by the board. */
  onNavigate?(path: string): void;
}

type Report = Exclude<Frame, { type: 'hello' | 'connect' | 'ready' | 'history' | 'zoom' }>;

export function connectPane(opts: ConnectPaneOptions): PaneHandle {
  let shell: { origin: ExactOrigin; nonce: string } | null = null;
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
      }
    }
    const data = event.data as { boogy?: unknown; type?: unknown; nonce?: unknown; payload?: { shellOrigin?: unknown } } | null;
    if (!data || data.boogy !== PANE_PROTOCOL || data.type !== 'connect') return;
    const offered = data.payload?.shellOrigin;
    if (typeof offered !== 'string' || offered !== event.origin) return;
    if (typeof data.nonce !== 'string' || data.nonce === '') return;

    let allowed: string[];
    try {
      allowed = (await loadPlatformConfig()).shellOrigins;
    } catch {
      return; // no config, no shell: the module keeps working on its own
    }
    if (!live || !allowed.includes(offered)) return;

    shell = { origin: exactOrigin(offered), nonce: data.nonce };
    // A history the board hands back (this pane's content moved to this
    // frame): adopted only if this page is its current page, so it can never
    // describe somewhere the pane is not.
    const parsed = parseFrame(data);
    const connectPayload = parsed?.type === 'connect' ? parsed.payload : undefined;
    const handed = connectPayload?.history;
    if (keepsHistory && handed && handed.entries[handed.index] === here()) {
      stack.splice(0, stack.length, ...handed.entries);
      index = handed.index;
      reportHistory();
    }
    // The size this board draws the pane at; a board that sends none (or one
    // out of bounds, which fails the frame check) leaves it at 1.
    if (connectPayload?.zoom !== undefined) setHostZoom(connectPayload.zoom);
    else clearHostZoom();
    sendFrame(window.parent, shell.origin, {
      boogy: PANE_PROTOCOL, type: 'ready', nonce: shell.nonce, payload: { service: opts.service },
    });
    for (const [type, payload] of latest) send(type, payload);
  };

  window.addEventListener('message', onMessage);

  // A board connects a frame when it loads, and an app that starts listening
  // after that would never hear it. So say hello to each board the platform
  // names: the one actually framing this page answers with a fresh connect,
  // and a message aimed at any other origin is dropped by the browser.
  void loadPlatformConfig().then(
    (config) => {
      if (!live) return;
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

  return {
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
      clearHostZoom();
      window.removeEventListener('message', onMessage);
    },
  };
}
