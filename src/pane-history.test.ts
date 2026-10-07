import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { PANE_PROTOCOL } from './internal/pane-protocol';
import { loadPlatformConfig } from './internal/platform-config';
import { connectPane } from './pane';

const SHELL = 'https://boards.example';

beforeAll(async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ authOrigin: 'https://auth.example', owner: 'foo', shellOrigins: [SHELL] }), { status: 200 }),
  );
  await loadPlatformConfig();
  vi.restoreAllMocks();
});

// A pane is in a frame: its parent is another window. The test DOM's page is
// top-level, so the parent is swapped for a stand-in that records what it is
// sent, and restored afterwards.
const realParent = window.parent;
function framed() {
  const parent = { postMessage: vi.fn() };
  Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
  return parent;
}
afterEach(() => {
  Object.defineProperty(window, 'parent', { configurable: true, get: () => realParent });
  vi.restoreAllMocks();
  history.replaceState(null, '', '/notes');
});
const settle = () => new Promise((r) => setTimeout(r, 0));

async function connected(parent: { postMessage: ReturnType<typeof vi.fn> }, onNavigate = vi.fn()) {
  const pane = connectPane({ service: 'notes', onNavigate });
  window.dispatchEvent(new MessageEvent('message', {
    origin: SHELL, source: parent as unknown as MessageEventSource,
    data: { boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n1', payload: { shellOrigin: SHELL, host: 'board' } },
  }));
  await vi.waitFor(() => expect(parent.postMessage.mock.calls.some((c) => c[0].type === 'ready')).toBe(true));
  parent.postMessage.mockClear();
  return { pane, onNavigate };
}
function fromBoard(parent: object, delta: -1 | 1) {
  window.dispatchEvent(new MessageEvent('message', {
    origin: SHELL, source: parent as MessageEventSource,
    data: { boogy: PANE_PROTOCOL, type: 'history', nonce: 'n1', payload: { delta } },
  }));
}
const sent = (parent: { postMessage: ReturnType<typeof vi.fn> }, type: string) =>
  parent.postMessage.mock.calls.filter((c) => c[0].type === type).map((c) => c[0].payload);

describe('in-pane history', () => {
  it('in a frame, navigate changes the address without adding browser history, and reports where and what is possible', async () => {
    history.replaceState(null, '', '/notes');
    const parent = framed();
    const { pane } = await connected(parent);
    const before = history.length;
    pane.navigate('/notes/1');
    expect(location.pathname).toBe('/notes/1');
    expect(history.length).toBe(before);
    expect(sent(parent, 'location').at(-1)).toEqual({ path: '/notes/1' });
    expect(sent(parent, 'history-state').at(-1)).toMatchObject({ canBack: true, canForward: false });
    pane.disconnect();
  });

  it('back and forward from the board move through the pane own history and render it', async () => {
    history.replaceState(null, '', '/notes');
    const parent = framed();
    const { pane, onNavigate } = await connected(parent);
    pane.navigate('/notes/1');
    pane.navigate('/notes/2');
    const beforeStep = history.length;
    fromBoard(parent, -1);
    expect(location.pathname).toBe('/notes/1');
    expect(history.length).toBe(beforeStep); // a board-driven step adds no browser history either
    expect(onNavigate).toHaveBeenLastCalledWith('/notes/1');
    expect(sent(parent, 'history-state').at(-1)).toMatchObject({ canBack: true, canForward: true });
    fromBoard(parent, 1);
    expect(onNavigate).toHaveBeenLastCalledWith('/notes/2');
    expect(sent(parent, 'history-state').at(-1)).toMatchObject({ canBack: true, canForward: false });
    pane.disconnect();
  });

  it('navigating after going back drops what was ahead', async () => {
    history.replaceState(null, '', '/notes');
    const parent = framed();
    const { pane } = await connected(parent);
    pane.navigate('/notes/1');
    pane.navigate('/notes/2');
    fromBoard(parent, -1);
    pane.navigate('/notes/3');
    expect(sent(parent, 'history-state').at(-1)).toMatchObject({ canBack: true, canForward: false });
    pane.disconnect();
  });

  it('a step past either end is ignored', async () => {
    history.replaceState(null, '', '/notes');
    const parent = framed();
    const { pane, onNavigate } = await connected(parent);
    fromBoard(parent, -1);
    fromBoard(parent, 1);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(location.pathname).toBe('/notes');
    pane.disconnect();
  });

  it('a board that connects late learns what is possible', async () => {
    history.replaceState(null, '', '/notes');
    const parent = framed();
    const pane = connectPane({ service: 'notes', onNavigate: () => {} });
    pane.navigate('/notes/1');
    window.dispatchEvent(new MessageEvent('message', {
      origin: SHELL, source: parent as unknown as MessageEventSource,
      data: { boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n9', payload: { shellOrigin: SHELL, host: 'board' } },
    }));
    await vi.waitFor(() => expect(sent(parent, 'history-state')).toMatchObject([{ canBack: true, canForward: false }]));
    pane.disconnect();
  });

  // Outside a board an app is an ordinary page: its own history is the
  // browser's, so the browser's back button keeps working.
  it('not in a frame, navigate is an ordinary browser navigation', async () => {
    history.replaceState(null, '', '/notes');
    const pane = connectPane({ service: 'notes' });
    const before = history.length;
    pane.navigate('/notes/1');
    expect(location.pathname).toBe('/notes/1');
    expect(history.length).toBe(before + 1);
    pane.disconnect();
  });

  it('a history frame with a stale nonce, or from another origin, is ignored', async () => {
    history.replaceState(null, '', '/notes');
    const parent = framed();
    const { pane, onNavigate } = await connected(parent);
    pane.navigate('/notes/1');
    const stale = { boogy: PANE_PROTOCOL, type: 'history', nonce: 'old', payload: { delta: -1 } };
    window.dispatchEvent(new MessageEvent('message', { origin: SHELL, source: parent as unknown as MessageEventSource, data: stale }));
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://evil.example', source: parent as unknown as MessageEventSource,
      data: { ...stale, nonce: 'n1' },
    }));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(location.pathname).toBe('/notes/1');
    pane.disconnect();
  });

  // An app that does not handle the board moving it has no business showing
  // back and forward: the buttons would be dead, or change the address
  // without the app rendering it.
  it('an app without onNavigate reports no history, so the board shows no buttons', async () => {
    history.replaceState(null, '', '/notes');
    const parent = framed();
    const pane = connectPane({ service: 'notes' });
    window.dispatchEvent(new MessageEvent('message', {
      origin: SHELL, source: parent as unknown as MessageEventSource,
      data: { boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n1', payload: { shellOrigin: SHELL, host: 'board' } },
    }));
    await vi.waitFor(() => expect(parent.postMessage.mock.calls.some((c) => c[0].type === 'ready')).toBe(true));
    pane.navigate('/notes/1');
    expect(sent(parent, 'history-state')).toEqual([]);
    pane.disconnect();
  });

  it('navigating to where the pane already is adds nothing', async () => {
    history.replaceState(null, '', '/notes');
    const parent = framed();
    const { pane } = await connected(parent);
    pane.navigate('/notes');
    expect(sent(parent, 'history-state').at(-1) ?? { canBack: false }).toMatchObject({ canBack: false });
    pane.disconnect();
  });

  // Sign-out: the pages before it belonged to someone signed in; back must
  // not lead to them.
  it('navigate with reset starts the pane history afresh', async () => {
    history.replaceState(null, '', '/notes');
    const parent = framed();
    const { pane } = await connected(parent);
    pane.navigate('/notes/1');
    pane.navigate('/notes', { reset: true });
    expect(sent(parent, 'history-state').at(-1)).toMatchObject({ canBack: false, canForward: false });
    pane.disconnect();
  });

  it('reports its whole history, so a board can keep it', async () => {
    history.replaceState(null, '', '/notes');
    const parent = framed();
    const { pane } = await connected(parent);
    pane.navigate('/notes/1');
    expect(sent(parent, 'history-state').at(-1)).toEqual({ canBack: true, canForward: false, entries: ['/notes', '/notes/1'], index: 1 });
    pane.disconnect();
  });

  // The board hands a pane its history back when the pane's content moves to
  // another frame (a new page load): back and forward keep working.
  it('adopts a history the board hands back when it is on that history current page', async () => {
    history.replaceState(null, '', '/notes/2');
    const parent = framed();
    const onNavigate = vi.fn();
    const pane = connectPane({ service: 'notes', onNavigate });
    window.dispatchEvent(new MessageEvent('message', {
      origin: SHELL, source: parent as unknown as MessageEventSource,
      data: { boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n1', payload: { shellOrigin: SHELL, host: 'board', history: { entries: ['/notes', '/notes/1', '/notes/2'], index: 2 } } },
    }));
    await vi.waitFor(() => expect(sent(parent, 'history-state').at(-1)).toEqual({ canBack: true, canForward: false, entries: ['/notes', '/notes/1', '/notes/2'], index: 2 }));
    fromBoard(parent, -1);
    expect(onNavigate).toHaveBeenLastCalledWith('/notes/1');
    pane.disconnect();
  });

  it('ignores a handed-back history whose current page is not where the pane is', async () => {
    history.replaceState(null, '', '/notes');
    const parent = framed();
    const pane = connectPane({ service: 'notes', onNavigate: () => {} });
    window.dispatchEvent(new MessageEvent('message', {
      origin: SHELL, source: parent as unknown as MessageEventSource,
      data: { boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n1', payload: { shellOrigin: SHELL, host: 'board', history: { entries: ['/notes', '/notes/9'], index: 1 } } },
    }));
    await vi.waitFor(() => expect(sent(parent, 'history-state').at(-1)).toEqual({ canBack: false, canForward: false, entries: ['/notes'], index: 0 }));
    pane.disconnect();
  });

  it('keeps at most 50 entries, dropping the oldest', async () => {
    history.replaceState(null, '', '/notes');
    const parent = framed();
    const { pane } = await connected(parent);
    for (let i = 1; i <= 60; i++) pane.navigate(`/notes/${i}`);
    const last = sent(parent, 'history-state').at(-1) as { entries: string[]; index: number };
    expect(last.entries).toHaveLength(50);
    expect(last.entries[0]).toBe('/notes/11');
    expect(last.index).toBe(49);
    pane.disconnect();
  });

  it('a history frame from anything but the parent window is ignored', async () => {
    history.replaceState(null, '', '/notes');
    const parent = framed();
    const { pane, onNavigate } = await connected(parent);
    pane.navigate('/notes/1');
    fromBoard({}, -1);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(location.pathname).toBe('/notes/1');
    pane.disconnect();
  });
});
