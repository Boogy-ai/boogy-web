// Sending and receiving frames, and the two rules that are structural rather
// than documented.
//
// 1. An exact target origin. `ExactOrigin` is a branded type produced only by
//    `exactOrigin`, which throws on `'*'` — so a wildcard has no expression at
//    a call site rather than being a discouraged argument.
// 2. Matching `event.source`. Each app runs on an origin of its own, but one
//    app can be shown in more than one frame at once (the same app in two
//    panes of a board), so `event.origin` names the app and cannot say which
//    frame spoke.

import { parseFrame, type Frame } from './pane-protocol';

declare const EXACT_ORIGIN: unique symbol;
export type ExactOrigin = string & { readonly [EXACT_ORIGIN]: true };

/** Validate a string as a bare origin. Throws on `'*'` and on anything else. */
export function exactOrigin(value: string): ExactOrigin {
  if (value === '*') {
    throw new Error('a wildcard target origin is not allowed on this channel');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`not an origin: ${value}`);
  }
  if (url.origin !== value) {
    throw new Error(`not a bare origin (found a path, query or fragment): ${value}`);
  }
  return value as ExactOrigin;
}

export function sendFrame(target: Window, origin: ExactOrigin, frame: Frame): void {
  target.postMessage(frame, origin);
}

export interface ReceiveOptions {
  nonce: string;
  isAllowedSource(source: MessageEventSource | null): boolean;
  onFrame(frame: Frame, event: MessageEvent): void;
}

/** Subscribe to protocol frames on `win`. Returns an unsubscribe. */
export function receiveFrames(win: Window, opts: ReceiveOptions): () => void {
  const listener = (event: MessageEvent) => {
    if (!opts.isAllowedSource(event.source)) return;
    const frame = parseFrame(event.data);
    if (frame === null) return;
    if (frame.nonce !== opts.nonce) return;
    opts.onFrame(frame, event);
  };
  win.addEventListener('message', listener);
  return () => win.removeEventListener('message', listener);
}
