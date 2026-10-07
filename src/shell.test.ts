import { describe, it, expect, vi } from 'vitest';
import { PANE_PROTOCOL } from './internal/pane-protocol';
import { createShell, MAX_TITLE_LENGTH, PANE_SANDBOX } from './shell';

const ORIGIN = 'https://foo.example';

// A frame the test controls: its window records what the shell sends, and
// `load()` fires the iframe's load event the way a (re)loaded page does.
function fakeFrame() {
  const win = { postMessage: vi.fn() } as unknown as MessageEventSource;
  const listeners: (() => void)[] = [];
  const el = {
    contentWindow: win,
    addEventListener: (type: string, fn: () => void) => { if (type === 'load') listeners.push(fn); },
    removeEventListener: (type: string, fn: () => void) => {
      const i = listeners.indexOf(fn);
      if (type === 'load' && i >= 0) listeners.splice(i, 1);
    },
  } as unknown as HTMLIFrameElement;
  const post = win.postMessage as unknown as ReturnType<typeof vi.fn>;
  return {
    el, win, post,
    load: () => listeners.slice().forEach((fn) => fn()),
    connects: () => post.mock.calls.filter((c) => c[0].type === 'connect').map((c) => ({ frame: c[0], origin: c[1] })),
    nonce: () => post.mock.calls.filter((c) => c[0].type === 'connect').at(-1)![0].nonce as string,
  };
}

function reg(id: string, service: string) {
  return { id, service, origin: ORIGIN };
}
function deliver(source: MessageEventSource, data: unknown, origin = ORIGIN) {
  window.dispatchEvent(new MessageEvent('message', { origin, source, data }));
}
const frame = (type: string, nonce: string, payload: unknown) => ({ boogy: PANE_PROTOCOL, type, nonce, payload });
/** The page now in `f` names its registered service and reports signed out. */
function signedOut(f: ReturnType<typeof fakeFrame>, service = 'squad') {
  deliver(f.win, frame('ready', f.nonce(), { service }));
  deliver(f.win, frame('auth-state', f.nonce(), { signedIn: false }));
}
/** Every answer the shell sent `f` to its sign-in requests, with its target origin. */
const results = (f: ReturnType<typeof fakeFrame>) =>
  f.post.mock.calls.filter((c) => c[0].type === 'sign-in-result').map((c) => [c[0], c[1]]);
const outcomes = (f: ReturnType<typeof fakeFrame>) => results(f).map((r) => (r[0] as { payload: { outcome: string } }).payload.outcome);

// The one sandbox of a frame holding an app, wherever it is shown. It never
// lets the app navigate the page framing it: a board swapped for a look-alike
// sign-in page is the phishing this closes. Sign-in is the framer's
// (`requestSignIn`); anything elsewhere opens a window of its own.
describe('PANE_SANDBOX', () => {
  it('grants no top-level navigation of any kind', () => {
    const tokens = PANE_SANDBOX.split(/\s+/);
    expect(tokens.filter((t) => t.startsWith('allow-top-navigation'))).toEqual([]);
  });

  it('lets an app open a real window of its own, and keep its own origin', () => {
    expect(PANE_SANDBOX.split(/\s+/)).toEqual(
      expect.arrayContaining(['allow-scripts', 'allow-same-origin', 'allow-popups', 'allow-popups-to-escape-sandbox']),
    );
  });
});

describe('createShell', () => {
  it('offers connect to exactly the pane origin, on registration and again on every load', () => {
    const shell = createShell({});
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    a.load();
    a.load(); // the pane navigated: a new page, which must be connected again
    const connects = a.connects();
    expect(connects).toHaveLength(3);
    for (const c of connects) {
      expect(c.origin).toBe(ORIGIN);
      expect(c.frame.payload).toEqual({ shellOrigin: window.location.origin, host: 'board' });
    }
    // A fresh nonce per page: a frame from the page before is stale.
    expect(new Set(connects.map((c) => c.frame.nonce)).size).toBe(3);
    shell.destroy();
  });

  it('answers a hello from a registered pane with a fresh connect', () => {
    const shell = createShell({});
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    const before = a.nonce();
    deliver(a.win, frame('hello', 'hello', { service: 'squad' }));
    expect(a.connects()).toHaveLength(2);
    expect(a.nonce()).not.toBe(before);
    shell.destroy();
  });

  it('ignores a hello from an unregistered frame or the wrong origin', () => {
    const shell = createShell({});
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    deliver(fakeFrame().win, frame('hello', 'hello', { service: 'squad' }));
    deliver(a.win, frame('hello', 'hello', { service: 'squad' }), 'https://evil.example');
    expect(a.connects()).toHaveLength(1);
    shell.destroy();
  });

  it('a title is capped by characters, never splitting one, and control and direction marks are removed', () => {
    const onTitle = vi.fn();
    const shell = createShell({ onTitle });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    deliver(a.win, frame('title', a.nonce(), { text: `\u202ea${'😀'.repeat(MAX_TITLE_LENGTH)}` }));
    const t = onTitle.mock.calls[0][1] as string;
    expect([...t]).toHaveLength(MAX_TITLE_LENGTH);
    expect(t.startsWith('a😀')).toBe(true);
    expect(t).not.toMatch(/\uFFFD/);
    shell.destroy();
  });

  it('emits ready for a registered pane and nothing for an unregistered frame', () => {
    const onReady = vi.fn();
    const shell = createShell({ onReady });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    deliver(a.win, frame('ready', a.nonce(), { service: 'squad' }));
    expect(onReady).toHaveBeenCalledWith('p1', 'squad');

    const stranger = fakeFrame();
    deliver(stranger.win, frame('ready', a.nonce(), { service: 'squad' }));
    expect(onReady).toHaveBeenCalledTimes(1);
    shell.destroy();
  });

  it('ignores a frame from the right window but the wrong origin', () => {
    const onTitle = vi.fn();
    const shell = createShell({ onTitle });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    deliver(a.win, frame('title', a.nonce(), { text: 'x' }), 'https://evil.example');
    expect(onTitle).not.toHaveBeenCalled();
    shell.destroy();
  });

  it('drops a frame carrying the nonce of the page before a reload', () => {
    const onTitle = vi.fn();
    const shell = createShell({ onTitle });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    const before = a.nonce();
    a.load();
    deliver(a.win, frame('title', before, { text: 'old page' }));
    expect(onTitle).not.toHaveBeenCalled();
    deliver(a.win, frame('title', a.nonce(), { text: 'new page' }));
    expect(onTitle).toHaveBeenCalledExactlyOnceWith('p1', 'new page');
    shell.destroy();
  });

  // Every pane on a board belongs to the board's owner, so they share one
  // origin: which pane spoke is known from the window, never from the origin.
  it('attributes a frame to the pane that sent it, not to its origin-mate', () => {
    const onTitle = vi.fn();
    const shell = createShell({ onTitle });
    const a = fakeFrame();
    const b = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    shell.registerPane(b.el, reg('p2', 'notes'));
    deliver(a.win, frame('title', a.nonce(), { text: 'Rooms' }));
    expect(onTitle).toHaveBeenCalledExactlyOnceWith('p1', 'Rooms');
    shell.destroy();
  });

  it('passes auth state through', () => {
    const onAuthState = vi.fn();
    const shell = createShell({ onAuthState });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    deliver(a.win, frame('ready', a.nonce(), { service: 'squad' }));
    deliver(a.win, frame('auth-state', a.nonce(), { signedIn: false }));
    expect(onAuthState).toHaveBeenCalledExactlyOnceWith('p1', false);
    shell.destroy();
  });

  // Whether an app is signed in decides whether a board signs it in, so it is
  // heard only from a page that has said which app it is and been believed.
  it('hears auth state only once the page has named its registered service', () => {
    const onAuthState = vi.fn();
    const shell = createShell({ onAuthState });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    deliver(a.win, frame('auth-state', a.nonce(), { signedIn: false }));
    expect(onAuthState).not.toHaveBeenCalled();
    deliver(a.win, frame('ready', a.nonce(), { service: 'squad' }));
    deliver(a.win, frame('auth-state', a.nonce(), { signedIn: false }));
    expect(onAuthState).toHaveBeenCalledExactlyOnceWith('p1', false);
    shell.destroy();
  });

  it('trims a title and caps its length; an empty one is not a title', () => {
    const onTitle = vi.fn();
    const shell = createShell({ onTitle });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    deliver(a.win, frame('title', a.nonce(), { text: '   ' }));
    deliver(a.win, frame('title', a.nonce(), { text: `  ${'x'.repeat(MAX_TITLE_LENGTH + 50)}  ` }));
    expect(onTitle).toHaveBeenCalledTimes(1);
    expect(onTitle.mock.calls[0][1]).toHaveLength(MAX_TITLE_LENGTH);
    shell.destroy();
  });

  it('refuses a location that leaves the origin or is not a plain path', () => {
    const onLocation = vi.fn();
    const shell = createShell({ onLocation });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    for (const path of ['https://evil.example/x', '//evil.example', '/squad/../x', '/\\evil.example']) {
      deliver(a.win, frame('location', a.nonce(), { path }));
    }
    expect(onLocation).not.toHaveBeenCalled();
    deliver(a.win, frame('location', a.nonce(), { path: '/squad/rooms/7' }));
    expect(onLocation).toHaveBeenCalledExactlyOnceWith('p1', '/squad/rooms/7');
    shell.destroy();
  });

  it('after unregistering, a pane is no longer heard or reconnected', () => {
    const onTitle = vi.fn();
    const shell = createShell({ onTitle });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    const nonce = a.nonce();
    shell.unregisterPane('p1');
    deliver(a.win, frame('title', nonce, { text: 'x' }));
    a.load();
    expect(onTitle).not.toHaveBeenCalled();
    expect(a.connects()).toHaveLength(1);
    shell.destroy();
  });

  it('re-registering a pane id replaces the old frame', () => {
    const onTitle = vi.fn();
    const shell = createShell({ onTitle });
    const a = fakeFrame();
    const b = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    const oldNonce = a.nonce();
    shell.registerPane(b.el, reg('p1', 'notes'));
    deliver(a.win, frame('title', oldNonce, { text: 'old' }));
    deliver(b.win, frame('title', b.nonce(), { text: 'new' }));
    expect(onTitle).toHaveBeenCalledExactlyOnceWith('p1', 'new');
    shell.destroy();
  });

  it('asks a pane to go back or forward, with the nonce of its current page', () => {
    const shell = createShell({});
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    shell.back('p1');
    shell.forward('p1');
    const moves = a.post.mock.calls.filter((c) => c[0].type === 'history');
    expect(moves.map((c) => [c[0].payload, c[0].nonce, c[1]])).toEqual([
      [{ delta: -1 }, a.nonce(), ORIGIN],
      [{ delta: 1 }, a.nonce(), ORIGIN],
    ]);
    shell.back('nope'); // an unknown pane is ignored
    shell.destroy();
  });

  it('after the pane reloads, back and forward carry the new page nonce', () => {
    const shell = createShell({});
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    a.load();
    shell.back('p1');
    const move = a.post.mock.calls.filter((c) => c[0].type === 'history').at(-1)!;
    expect(move[0].nonce).toBe(a.nonce());
    shell.destroy();
  });

  // A pane's content moved to another frame: the board hands its history to
  // the new frame on connect, and keeps the latest one for when a frame reloads.
  it('hands a registered pane its history on connect, and keeps the latest reported one', () => {
    const onHistoryState = vi.fn();
    const shell = createShell({ onHistoryState });
    const a = fakeFrame();
    shell.registerPane(a.el, { ...reg('p1', 'squad'), history: { entries: ['/squad', '/squad/c/maya'], index: 1 } });
    expect(a.connects().at(-1)!.frame.payload.history).toEqual({ entries: ['/squad', '/squad/c/maya'], index: 1 });
    deliver(a.win, frame('history-state', a.nonce(), { canBack: true, canForward: true, entries: ['/squad', '/squad/c/maya', '/squad/c/bo'], index: 1 }));
    expect(onHistoryState).toHaveBeenLastCalledWith('p1', true, true, { entries: ['/squad', '/squad/c/maya', '/squad/c/bo'], index: 1 });
    a.load();
    expect(a.connects().at(-1)!.frame.payload.history).toEqual({ entries: ['/squad', '/squad/c/maya', '/squad/c/bo'], index: 1 });
    shell.destroy();
  });

  it('never keeps or hands back a history with an entry that is not a plain path', () => {
    const onHistoryState = vi.fn();
    const shell = createShell({ onHistoryState });
    const a = fakeFrame();
    shell.registerPane(a.el, { ...reg('p1', 'squad'), history: { entries: ['/squad', '//evil.example'], index: 1 } });
    expect(a.connects().at(-1)!.frame.payload.history).toBeUndefined();
    deliver(a.win, frame('history-state', a.nonce(), { canBack: true, canForward: false, entries: ['/squad', '//evil.example'], index: 1 }));
    expect(onHistoryState).toHaveBeenLastCalledWith('p1', true, false, undefined);
    shell.destroy();
  });

  it('passes what a pane says is possible', () => {
    const onHistoryState = vi.fn();
    const shell = createShell({ onHistoryState });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    deliver(a.win, frame('history-state', a.nonce(), { canBack: true, canForward: false }));
    expect(onHistoryState).toHaveBeenCalledExactlyOnceWith('p1', true, false, undefined);
    shell.destroy();
  });

  it('refuses a pane that reports a service other than the one registered for it', () => {
    const onReady = vi.fn();
    const onServiceMismatch = vi.fn();
    const onTitle = vi.fn();
    const shell = createShell({ onReady, onServiceMismatch, onTitle });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'probe'));
    const nonce = a.nonce();
    deliver(a.win, frame('ready', nonce, { service: 'squad' }));
    expect(onReady).not.toHaveBeenCalled();
    expect(onServiceMismatch).toHaveBeenCalledWith('p1', 'squad');
    // Nothing more is heard from that page.
    deliver(a.win, frame('title', nonce, { text: 'Squad' }));
    expect(onTitle).not.toHaveBeenCalled();
    shell.destroy();
  });

  it('a refused pane stays refused until its frame loads a new page', () => {
    const onReady = vi.fn();
    const onServiceMismatch = vi.fn();
    const onTitle = vi.fn();
    const shell = createShell({ onReady, onServiceMismatch, onTitle });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'probe'));
    const nonce = a.nonce();
    deliver(a.win, frame('ready', nonce, { service: 'squad' }));
    expect(onServiceMismatch).toHaveBeenCalledWith('p1', 'squad');

    // A hello from the same, still-refused page does not reconnect it.
    const connectsBefore = a.connects().length;
    deliver(a.win, frame('hello', 'hello', { service: 'squad' }));
    expect(a.connects()).toHaveLength(connectsBefore);

    // Nor is anything else from that page acted on.
    deliver(a.win, frame('title', nonce, { text: 'Squad' }));
    expect(onTitle).not.toHaveBeenCalled();

    // The frame loads a NEW page: that page gets a fresh chance.
    a.load();
    expect(a.connects()).toHaveLength(connectsBefore + 1);
    deliver(a.win, frame('ready', a.nonce(), { service: 'probe' }));
    expect(onReady).toHaveBeenCalledWith('p1', 'probe');
    shell.destroy();
  });

  // A shell names itself in every connect, and an app words its sign-in by it
  // (in a board, the board signs it in). A board is the only page that frames
  // apps: an app shown alone is at its own address, unframed.
  it('names its host in every connect: a board', () => {
    const board = createShell({});
    const a = fakeFrame();
    board.registerPane(a.el, reg('p1', 'squad'));
    a.load();
    expect(a.connects().map((c) => c.frame.payload.host)).toEqual(['board', 'board']);
    board.destroy();
    // @ts-expect-error — a shell is a board; there is no other host to name
    createShell({}, { host: 'standalone' }).destroy();
  });

  // A board tells an app, in every connect, how the last sign-in trip it made
  // for it ended when that did not sign it in — and says nothing otherwise.
  it('tells a pane in each connect how its last sign-in ended, only when the board says so', () => {
    const shell = createShell({});
    const a = fakeFrame();
    shell.registerPane(a.el, { ...reg('p1', 'squad'), lastSignIn: 'cancelled' });
    a.load();
    expect(a.connects().map((c) => c.frame.payload.lastSignIn)).toEqual(['cancelled', 'cancelled']);
    const b = fakeFrame();
    shell.registerPane(b.el, reg('p2', 'squad'));
    expect('lastSignIn' in b.connects()[0].frame.payload).toBe(false);
    shell.destroy();
  });

  it('reports a sign-in request from a connected pane that named its service and reported signed out', () => {
    const onSignInRequested = vi.fn(() => 'leaving' as const);
    const shell = createShell({ onSignInRequested });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    signedOut(a);
    deliver(a.win, frame('sign-in', a.nonce(), {}));
    expect(onSignInRequested).toHaveBeenCalledExactlyOnceWith('p1');
    shell.destroy();
  });

  // The shell answers every request it hears, to that pane's own frame, at its
  // origin, with the nonce of the page that asked.
  it('answers a sign-in request with what the board decided', async () => {
    const decided = [{ busy: 5000 }, 'leaving', 'unavailable'] as const;
    let i = 0;
    const shell = createShell({ onSignInRequested: () => decided[i++] });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    signedOut(a);
    for (let k = 0; k < decided.length; k += 1) deliver(a.win, frame('sign-in', a.nonce(), {}));
    await vi.waitFor(() => expect(results(a)).toHaveLength(3));
    expect(results(a)).toEqual([
      [{ boogy: PANE_PROTOCOL, type: 'sign-in-result', nonce: a.nonce(), payload: { outcome: 'busy', retryAfterMs: 5000 } }, ORIGIN],
      [{ boogy: PANE_PROTOCOL, type: 'sign-in-result', nonce: a.nonce(), payload: { outcome: 'leaving' } }, ORIGIN],
      [{ boogy: PANE_PROTOCOL, type: 'sign-in-result', nonce: a.nonce(), payload: { outcome: 'unavailable' } }, ORIGIN],
    ]);
    shell.destroy();
  });

  it('answers once the board has decided, when deciding takes a while', async () => {
    let decide: (r: 'leaving') => void = () => {};
    const shell = createShell({ onSignInRequested: () => new Promise((r) => { decide = r; }) });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    signedOut(a);
    deliver(a.win, frame('sign-in', a.nonce(), {}));
    await Promise.resolve();
    expect(results(a)).toHaveLength(0);
    decide('leaving');
    await vi.waitFor(() => expect(outcomes(a)).toEqual(['leaving']));
    shell.destroy();
  });

  // An app that has not said whether anyone is signed in cannot ask to be
  // signed in, and one that says someone is, is told so: neither reaches the
  // board, so neither can send the person to sign in.
  it('refuses a sign-in request before the page has reported its auth state', async () => {
    const onSignInRequested = vi.fn(() => 'leaving' as const);
    const shell = createShell({ onSignInRequested });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    deliver(a.win, frame('ready', a.nonce(), { service: 'squad' }));
    deliver(a.win, frame('sign-in', a.nonce(), {}));
    await vi.waitFor(() => expect(outcomes(a)).toEqual(['unavailable']));
    expect(onSignInRequested).not.toHaveBeenCalled();
    shell.destroy();
  });

  it('answers already_signed_in to a page whose last report was signed in', async () => {
    const onSignInRequested = vi.fn(() => 'leaving' as const);
    const shell = createShell({ onSignInRequested });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    signedOut(a);
    deliver(a.win, frame('auth-state', a.nonce(), { signedIn: true }));
    deliver(a.win, frame('sign-in', a.nonce(), {}));
    await vi.waitFor(() => expect(outcomes(a)).toEqual(['already_signed_in']));
    expect(onSignInRequested).not.toHaveBeenCalled();
    shell.destroy();
  });

  // Each page reports for itself: a report from the page before a reload says
  // nothing about the page now in the frame.
  it('a page that reloads must report again before it may ask', async () => {
    const onSignInRequested = vi.fn(() => 'leaving' as const);
    const shell = createShell({ onSignInRequested });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    signedOut(a);
    a.load();
    deliver(a.win, frame('ready', a.nonce(), { service: 'squad' }));
    deliver(a.win, frame('sign-in', a.nonce(), {}));
    await vi.waitFor(() => expect(outcomes(a)).toEqual(['unavailable']));
    expect(onSignInRequested).not.toHaveBeenCalled();
    shell.destroy();
  });

  it('a page framed by something that signs nothing in is told unavailable', async () => {
    const shell = createShell({});
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    signedOut(a);
    deliver(a.win, frame('sign-in', a.nonce(), {}));
    await vi.waitFor(() => expect(outcomes(a)).toEqual(['unavailable']));
    shell.destroy();
  });

  it('an answer that is not one is sent as unavailable', async () => {
    for (const bad of [undefined, 'maybe', { busy: -1 }, { busy: 1.5 }]) {
      const shell = createShell({ onSignInRequested: () => bad as never });
      const a = fakeFrame();
      shell.registerPane(a.el, reg('p1', 'squad'));
      signedOut(a);
      deliver(a.win, frame('sign-in', a.nonce(), {}));
      await vi.waitFor(() => expect(outcomes(a), JSON.stringify(bad)).toEqual(['unavailable']));
      shell.destroy();
    }
  });

  // The page that asked is gone: its answer would reach the page after it.
  it('an answer decided after the frame loaded another page is not sent', async () => {
    let decide: (r: 'leaving') => void = () => {};
    const shell = createShell({ onSignInRequested: () => new Promise((r) => { decide = r; }) });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    signedOut(a);
    deliver(a.win, frame('sign-in', a.nonce(), {}));
    a.load();
    decide('leaving');
    await new Promise((r) => setTimeout(r, 0));
    expect(results(a)).toHaveLength(0);
    shell.destroy();
  });

  // Only the pane's own frame, from the origin bound to it, on the page the
  // shell connected, once that page has named the service registered for it.
  it('ignores a sign-in request from anything but its bound, connected, ready pane', () => {
    const onSignInRequested = vi.fn();
    const shell = createShell({ onSignInRequested });
    const a = fakeFrame();
    const b = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    shell.registerPane(b.el, reg('p2', 'notes'));
    // Before the page has said who it is: its connect was answered, nothing more.
    deliver(a.win, frame('sign-in', a.nonce(), {}));
    expect(onSignInRequested).not.toHaveBeenCalled();
    deliver(a.win, frame('ready', a.nonce(), { service: 'squad' }));
    deliver(a.win, frame('auth-state', a.nonce(), { signedIn: false }));
    // Another frame using this pane's nonce, an unregistered window, the wrong
    // origin, no nonce of any connect, and the nonce of the page before a reload.
    deliver(b.win, frame('sign-in', a.nonce(), {}));
    deliver(fakeFrame().win, frame('sign-in', a.nonce(), {}));
    deliver(a.win, frame('sign-in', a.nonce(), {}), 'https://evil.example');
    deliver(a.win, frame('sign-in', 'guessed', {}));
    const before = a.nonce();
    a.load();
    deliver(a.win, frame('sign-in', before, {}));
    // The new page has not named its service yet either.
    deliver(a.win, frame('sign-in', a.nonce(), {}));
    expect(onSignInRequested).not.toHaveBeenCalled();
    signedOut(a);
    deliver(a.win, frame('sign-in', a.nonce(), {}));
    expect(onSignInRequested).toHaveBeenCalledExactlyOnceWith('p1');
    shell.destroy();
  });

  it('ignores a sign-in request from a refused pane', () => {
    const onSignInRequested = vi.fn();
    const shell = createShell({ onSignInRequested });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'probe'));
    const nonce = a.nonce();
    deliver(a.win, frame('ready', nonce, { service: 'squad' }));
    deliver(a.win, frame('sign-in', nonce, {}));
    expect(onSignInRequested).not.toHaveBeenCalled();
    shell.destroy();
  });

  // A pane registered with no service could never be checked against one, so
  // it is not connected at all: nothing it says is heard.
  it('refuses a registration with no service: no connect, nothing heard', () => {
    const onReady = vi.fn();
    const onTitle = vi.fn();
    const onSignInRequested = vi.fn();
    const shell = createShell({ onReady, onTitle, onSignInRequested });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', ''));
    a.load();
    deliver(a.win, frame('hello', 'hello', { service: 'squad' }));
    expect(a.connects()).toHaveLength(0);
    deliver(a.win, frame('ready', 'n', { service: 'squad' }));
    deliver(a.win, frame('title', 'n', { text: 'Squad' }));
    deliver(a.win, frame('sign-in', 'n', {}));
    expect(onReady).not.toHaveBeenCalled();
    expect(onTitle).not.toHaveBeenCalled();
    expect(onSignInRequested).not.toHaveBeenCalled();
    shell.destroy();
  });

  it('stops listening after destroy', () => {
    const onTitle = vi.fn();
    const shell = createShell({ onTitle });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    const nonce = a.nonce();
    shell.destroy();
    deliver(a.win, frame('title', nonce, { text: 'x' }));
    expect(onTitle).not.toHaveBeenCalled();
  });
});
describe('createShell zoom', () => {
  const zooms = (f: ReturnType<typeof fakeFrame>) =>
    f.post.mock.calls.filter((c) => c[0].type === 'zoom').map((c) => {
      expect(c[0].nonce).toBe(f.nonce());
      return c[0].payload.factor as number;
    });

  it('sends the board-wide zoom to every pane, and puts it in each later connect', () => {
    const shell = createShell({});
    const a = fakeFrame();
    const b = fakeFrame();
    shell.registerPane(a.el, reg('a', 'notes'));
    shell.registerPane(b.el, reg('b', 'squad'));
    shell.setZoom(1.5);
    expect(zooms(a)).toEqual([1.5]);
    expect(zooms(b)).toEqual([1.5]);
    a.load();
    expect(a.connects().at(-1)!.frame.payload.zoom).toBe(1.5);
    shell.destroy();
  });

  it('says nothing about zoom in a connect while the pane is at 1', () => {
    const shell = createShell({});
    const a = fakeFrame();
    shell.registerPane(a.el, reg('a', 'notes'));
    expect('zoom' in a.connects().at(-1)!.frame.payload).toBe(false);
    shell.destroy();
  });

  it('an override reaches only its pane, outranks the board, and null follows the board again', () => {
    const shell = createShell({});
    const a = fakeFrame();
    const b = fakeFrame();
    shell.registerPane(a.el, reg('a', 'notes'));
    shell.registerPane(b.el, reg('b', 'squad'));
    shell.setPaneZoom('a', 2);
    shell.setZoom(1.25);
    expect(zooms(a)).toEqual([2]);
    expect(zooms(b)).toEqual([1.25]);
    shell.setPaneZoom('a', null);
    expect(zooms(a)).toEqual([2, 1.25]);
    shell.destroy();
  });

  it('an override survives the pane being registered again, and a reload', () => {
    const shell = createShell({});
    const a = fakeFrame();
    shell.registerPane(a.el, reg('a', 'notes'));
    shell.setPaneZoom('a', 1.75);
    shell.unregisterPane('a');
    shell.registerPane(a.el, reg('a', 'notes'));
    expect(a.connects().at(-1)!.frame.payload.zoom).toBe(1.75);
    a.load();
    expect(a.connects().at(-1)!.frame.payload.zoom).toBe(1.75);
    shell.destroy();
  });

  it('clamps a factor to [0.5, 3] and ignores one that is not finite', () => {
    const shell = createShell({});
    const a = fakeFrame();
    shell.registerPane(a.el, reg('a', 'notes'));
    shell.setZoom(10);
    shell.setZoom(0.1);
    shell.setZoom(Number.NaN);
    shell.setPaneZoom('a', Infinity);
    expect(zooms(a)).toEqual([3, 0.5]);
    shell.destroy();
  });
});
