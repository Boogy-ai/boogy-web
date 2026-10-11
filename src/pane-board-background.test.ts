// An app that declared `[boards] background = "board"`: in a board it draws
// no page background, in the board's scheme, and says so in its ready.
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { PANE_PROTOCOL } from './internal/pane-protocol';
import { loadPlatformConfig } from './internal/platform-config';
import { connectPane } from './pane';

const SHELL = 'https://boards.example';
const root = document.documentElement;
const realParent = window.parent;

beforeAll(async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ authOrigin: 'https://auth.example', owner: 'foo', shellOrigins: [SHELL], boardBackground: 'board' }), { status: 200 }),
  );
  await loadPlatformConfig();
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'parent', { configurable: true, get: () => realParent });
  const slot = (globalThis as Record<symbol, { disconnect(): void } | undefined>)[Symbol.for('boogy.pane/v1')];
  slot?.disconnect();
  delete (globalThis as Record<symbol, unknown>)[Symbol.for('boogy.pane/v1')];
});

const spyPost = () => {
  const parent = { postMessage: vi.fn() };
  Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
  return parent.postMessage;
};
const connect = (payload: Record<string, unknown>, nonce = 'n1') =>
  window.dispatchEvent(new MessageEvent('message', {
    origin: SHELL, source: window.parent,
    data: { boogy: PANE_PROTOCOL, type: 'connect', nonce, payload: { shellOrigin: SHELL, ...payload } },
  }));
const readyOf = (post: ReturnType<typeof spyPost>) =>
  post.mock.calls.map((c) => c[0] as { type: string; payload: Record<string, unknown> }).find((m) => m.type === 'ready');

describe('an app that shows the board background', () => {
  it('in a board with a scheme: marks the page and takes the scheme BEFORE it answers ready, and says so', async () => {
    const post = spyPost();
    let markedWhenReady: boolean | null = null;
    post.mockImplementation((m: { type: string }) => {
      if (m.type === 'ready') markedWhenReady = root.hasAttribute('data-board-background');
    });
    const pane = connectPane({ service: 'polls' });
    connect({ host: 'board', scheme: 'dark' });
    await vi.waitFor(() => expect(readyOf(post)).toBeTruthy());
    expect(markedWhenReady).toBe(true);
    expect(readyOf(post)!.payload.background).toBe('board');
    // INLINE, so an app's own `:root { color-scheme: light dark }` cannot outrank it.
    expect(root.style.colorScheme).toBe('dark');
    expect(root.style.getPropertyValue('--scheme')).toBe('dark');
    pane.disconnect();
    expect(root.hasAttribute('data-board-background')).toBe(false);
    expect(root.style.colorScheme).toBe('');
  });

  it('from a board that sends no scheme (an older board): changes nothing, and says nothing', async () => {
    const post = spyPost();
    const pane = connectPane({ service: 'polls' });
    connect({ host: 'board' });
    await vi.waitFor(() => expect(readyOf(post)).toBeTruthy());
    expect(root.hasAttribute('data-board-background')).toBe(false);
    expect(readyOf(post)!.payload.background).toBeUndefined();
    pane.disconnect();
  });

  it('from a page that is not a board: changes nothing', async () => {
    const post = spyPost();
    const pane = connectPane({ service: 'polls' });
    connect({ scheme: 'dark' });
    await vi.waitFor(() => expect(readyOf(post)).toBeTruthy());
    expect(root.hasAttribute('data-board-background')).toBe(false);
    pane.disconnect();
  });

  it('follows the latest connect: a reconnect without a scheme clears what the last one set', async () => {
    const post = spyPost();
    const pane = connectPane({ service: 'polls' });
    connect({ host: 'board', scheme: 'dark' }, 'n1');
    await vi.waitFor(() => expect(root.hasAttribute('data-board-background')).toBe(true));
    connect({ host: 'board' }, 'n2');
    await vi.waitFor(() => expect(root.hasAttribute('data-board-background')).toBe(false));
    pane.disconnect();
  });
});
