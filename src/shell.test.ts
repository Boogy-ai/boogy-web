import { describe, it, expect, vi } from 'vitest';
import { PANE_PROTOCOL } from './internal/pane-protocol';
import { createShell, MAX_TITLE_LENGTH } from './shell';

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
  return { id, service, origin: ORIGIN, mount: `/${service}` };
}
function deliver(source: MessageEventSource, data: unknown, origin = ORIGIN) {
  window.dispatchEvent(new MessageEvent('message', { origin, source, data }));
}
const frame = (type: string, nonce: string, payload: unknown) => ({ boogy: PANE_PROTOCOL, type, nonce, payload });

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
      expect(c.frame.payload).toEqual({ shellOrigin: window.location.origin });
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

  it('refuses a location outside the pane own mount, or one that leaves the origin', () => {
    const onLocation = vi.fn();
    const shell = createShell({ onLocation });
    const a = fakeFrame();
    shell.registerPane(a.el, reg('p1', 'squad'));
    for (const path of ['https://evil.example/x', '//evil.example', '/notes/x', '/squad/../x', '/\\evil.example']) {
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

  it('never keeps or hands back a history with an entry outside the pane address', () => {
    const onHistoryState = vi.fn();
    const shell = createShell({ onHistoryState });
    const a = fakeFrame();
    shell.registerPane(a.el, { ...reg('p1', 'squad'), history: { entries: ['/squad', '//evil.example'], index: 1 } });
    expect(a.connects().at(-1)!.frame.payload.history).toBeUndefined();
    deliver(a.win, frame('history-state', a.nonce(), { canBack: true, canForward: false, entries: ['/squad', '/other/x'], index: 1 }));
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
