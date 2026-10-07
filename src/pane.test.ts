import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { PANE_PROTOCOL } from './internal/pane-protocol';
import { loadPlatformConfig } from './internal/platform-config';
import { connectPane, SIGN_IN_REPLY_TIMEOUT_MS } from './pane';
import { zoomState } from './layout/zoom';

const SHELL = 'https://boards.example';

// The platform names one shell for this origin. The SDK caches its config per
// page, so it is loaded once, the way a real page loads it.
beforeAll(async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ authOrigin: 'https://auth.example', owner: 'foo', shellOrigins: [SHELL] }), { status: 200 }),
  );
  await loadPlatformConfig();
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'parent', { configurable: true, get: () => realParent });
  // The pane slot lives on `globalThis` and survives `vi.resetModules()`.
  // Disconnect whatever holds it first — otherwise its listener and history
  // patch stay live for the rest of the file — then clear the slot itself so
  // one test's pane can't be mistaken for another's.
  const slot = (globalThis as Record<symbol, { disconnect(): void } | undefined>)[Symbol.for('boogy.pane/v1')];
  slot?.disconnect();
  delete (globalThis as Record<symbol, unknown>)[Symbol.for('boogy.pane/v1')];
});

function fromShell(data: unknown, origin = SHELL) {
  window.dispatchEvent(new MessageEvent('message', { origin, source: window.parent, data }));
}
function connectFrom(shellOrigin: string, nonce = 'n1', host: unknown = 'board') {
  fromShell({ boogy: PANE_PROTOCOL, type: 'connect', nonce, payload: { shellOrigin, host } }, shellOrigin);
}
const settle = () => new Promise((r) => setTimeout(r, 0));
/** The shell's answer to a sign-in request, from the shell, with `nonce`. */
const answer = (nonce: string, payload: unknown) =>
  fromShell({ boogy: PANE_PROTOCOL, type: 'sign-in-result', nonce, payload });
// A real browser drops a message whose target origin does not match the
// receiver; the test DOM throws instead, and here the test page is its own
// parent. So the send is recorded, not performed.
const realParent = window.parent;
// The page is framed: its parent is another window, whose sends are recorded.
const spyPost = () => {
  const parent = { postMessage: vi.fn() };
  Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
  return parent.postMessage;
};
// Start a pane and let its hello go out, so a test counts only what follows.
async function started(post: ReturnType<typeof spyPost>) {
  const pane = connectPane({ service: 'squad' });
  await vi.waitFor(() => expect(post).toHaveBeenCalled());
  post.mockClear();
  return pane;
}

describe('connectPane', () => {
  it('answers ready, naming its service, only to a shell origin the platform names', async () => {
    const post = spyPost();
    const pane = await started(post);
    connectFrom(SHELL);
    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toMatchObject({ boogy: PANE_PROTOCOL, type: 'ready', nonce: 'n1', payload: { service: 'squad' } });
    expect(post.mock.calls[0][1]).toBe(SHELL);
    pane.disconnect();
  });

  it('ignores a connect from an origin the platform does not name', async () => {
    const post = spyPost();
    const pane = await started(post);
    connectFrom('https://evil.example');
    await settle();
    expect(post).not.toHaveBeenCalled();
    pane.disconnect();
  });

  it('ignores a connect whose claimed origin is not the origin it came from', async () => {
    const post = spyPost();
    const pane = await started(post);
    fromShell({ boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n1', payload: { shellOrigin: SHELL, host: 'board' } }, 'https://evil.example');
    await settle();
    expect(post).not.toHaveBeenCalled();
    pane.disconnect();
  });

  it('once connected, reports title, location and auth state to that shell with its nonce', async () => {
    const post = spyPost();
    const pane = await started(post);
    connectFrom(SHELL, 'n7');
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    pane.reportTitle('Rooms');
    pane.reportLocation('/squad/rooms/1');
    pane.reportAuthState(true);
    expect(post.mock.calls.slice(1).map((c) => [c[0], c[1]])).toEqual([
      [{ boogy: PANE_PROTOCOL, type: 'title', nonce: 'n7', payload: { text: 'Rooms' } }, SHELL],
      [{ boogy: PANE_PROTOCOL, type: 'location', nonce: 'n7', payload: { path: '/squad/rooms/1' } }, SHELL],
      [{ boogy: PANE_PROTOCOL, type: 'auth-state', nonce: 'n7', payload: { signedIn: true } }, SHELL],
    ]);
    pane.disconnect();
  });

  it('reports what it already knew when the shell connects late', async () => {
    const post = spyPost();
    const pane = await started(post);
    pane.reportTitle('Rooms');
    pane.reportLocation('/squad/rooms/1');
    connectFrom(SHELL, 'n8');
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(3));
    expect(post.mock.calls.map((c) => (c[0] as { type: string }).type)).toEqual(['ready', 'title', 'location']);
    pane.disconnect();
  });

  // Degradation: a module loaded on its own gets no `connect`, and an SDK that
  // throws there breaks every direct visit to the module.
  it('is inert, not broken, when no shell ever connects', () => {
    const post = spyPost();
    const pane = connectPane({ service: 'squad' });
    expect(() => {
      pane.reportAuthState(true);
      pane.reportTitle('Rooms');
      pane.reportLocation('/squad/rooms/1');
    }).not.toThrow();
    expect(post).not.toHaveBeenCalled();
    pane.disconnect();
  });

  // A board sends connect when the frame loads; an app that starts listening
  // after that (a component effect, say) would never hear it. So the pane
  // says hello to each board the platform names, and the board answers.
  it('says hello to each board the platform names, so a board it missed can connect it', async () => {
    const post = spyPost();
    const pane = connectPane({ service: 'squad' });
    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toMatchObject({ boogy: PANE_PROTOCOL, type: 'hello', payload: { service: 'squad' } });
    expect(post.mock.calls[0][1]).toBe(SHELL);
    pane.disconnect();
  });

  // A page that is not framed has no board to greet.
  it('says no hello when the page is not framed', async () => {
    Object.defineProperty(window, 'parent', { configurable: true, get: () => window });
    const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    const pane = connectPane({ service: 'squad' });
    await settle();
    await settle();
    expect(post).not.toHaveBeenCalled();
    pane.disconnect();
  });

  it('ignores a connect that does not come from its parent window', async () => {
    const post = spyPost();
    const pane = await started(post);
    window.dispatchEvent(new MessageEvent('message', {
      origin: SHELL, source: {} as MessageEventSource,
      data: { boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n1', payload: { shellOrigin: SHELL, host: 'board' } },
    }));
    await settle();
    expect(post).not.toHaveBeenCalled();
    pane.disconnect();
  });

  it('a connect whose config check is still in flight is dropped if the pane disconnects meanwhile', async () => {
    const post = spyPost();
    const pane = await started(post);
    connectFrom(SHELL);
    pane.disconnect();
    await settle();
    expect(post).not.toHaveBeenCalled();
  });

  it('after disconnect, a connect is no longer answered', async () => {
    const post = spyPost();
    const pane = await started(post);
    pane.disconnect();
    connectFrom(SHELL);
    await settle();
    expect(post).not.toHaveBeenCalled();
  });

  it('replaces the automatic pane when the app connects its own', async () => {
    const { connectAutoPane } = await import('./pane');
    const post = spyPost();
    const auto = connectAutoPane({ service: 'squad' });
    expect(auto).not.toBeNull();
    const app = await started(post);
    connectFrom(SHELL);
    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    // Exactly one ready: the app's. The retired automatic pane no longer answers.
    expect(post.mock.calls.filter((c) => c[0].type === 'ready')).toHaveLength(1);
    app.disconnect();
  });

  // Where the app is shown is told in the connect, so an app can word its
  // sign-in: in a board the board signs it in; alone, it offers a button.
  it('learns its host from the connect that connects it', async () => {
    const post = spyPost();
    const hosts: (string | null)[] = [];
    const pane = connectPane({ service: 'squad', onConnect: ({ host }) => void hosts.push(host) });
    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    expect(pane.host).toBeNull();
    connectFrom(SHELL, 'n1', 'board');
    await vi.waitFor(() => expect(pane.host).toBe('board'));
    // A page that names a host this version does not know (an old shell that
    // framed one app alone) still connects it, with no host.
    connectFrom(SHELL, 'n2', 'standalone');
    await vi.waitFor(() => expect(hosts).toHaveLength(2));
    expect(pane.host).toBeNull();
    expect(hosts).toEqual(['board', null]);
    pane.disconnect();
    expect(pane.host).toBeNull();
  });

  // A page that does not say where the app is shown still connects: the app
  // just does not know, which is never the same as being told "board".
  it('a connect that does not say where it is shown connects, with no host', async () => {
    const post = spyPost();
    const hosts: (string | null)[] = [];
    const pane = connectPane({ service: 'squad', onConnect: ({ host }) => void hosts.push(host) });
    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    post.mockClear();
    fromShell({ boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n1', payload: { shellOrigin: SHELL } });
    await vi.waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready' }), SHELL));
    expect(pane.host).toBeNull();
    connectFrom(SHELL, 'n2', 'console');
    await vi.waitFor(() => expect(hosts).toHaveLength(2));
    expect(hosts).toEqual([null, null]);
    pane.disconnect();
  });

  // A page naming a host this version does not know is a page from a newer
  // board: what else its connect says (the size to draw at) still applies.
  it('a connect naming a host this version does not know still sets the size it names', async () => {
    const post = spyPost();
    const pane = await started(post);
    fromShell({ boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n1', payload: { shellOrigin: SHELL, host: 'console', zoom: 1.5 } });
    await vi.waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready' }), SHELL));
    expect(zoomState().host).toBe(1.5);
    expect(pane.host).toBeNull();
    pane.disconnect();
  });

  // A board says, in its connect, how the last sign-in it made for this app
  // ended when it did not sign it in, so the app can say so beside its button.
  it('learns how the last sign-in its page made for it ended, when it did not sign it in', async () => {
    const post = spyPost();
    const infos: unknown[] = [];
    const pane = connectPane({ service: 'squad', onConnect: (info) => void infos.push(info) });
    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    expect(pane.lastSignIn).toBeNull();
    fromShell({ boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n1', payload: { shellOrigin: SHELL, host: 'board', lastSignIn: 'cancelled' } });
    await vi.waitFor(() => expect(pane.lastSignIn).toBe('cancelled'));
    connectFrom(SHELL, 'n2', 'board');
    await vi.waitFor(() => expect(infos).toHaveLength(2));
    expect(pane.lastSignIn).toBeNull();
    expect(infos).toEqual([{ host: 'board', lastSignIn: 'cancelled' }, { host: 'board', lastSignIn: null }]);
    pane.disconnect();
  });

  // A board can connect the page anew while a request waits (it answers a
  // `hello` with a fresh connect). The request is asked again on the new
  // connection — after the page's state, so the board has heard it — with a
  // fresh wait, rather than lost to a nonce the board no longer answers.
  it('a request waiting when its page is connected anew is asked again there, and answered', async () => {
    const post = spyPost();
    const pane = await started(post);
    connectFrom(SHELL, 'n5', 'board');
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    pane.reportAuthState(false);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      let settled: unknown = 'pending';
      void pane.requestSignIn().then((r) => { settled = r; });
      await vi.advanceTimersByTimeAsync(SIGN_IN_REPLY_TIMEOUT_MS - 500);
      post.mockClear();
      connectFrom(SHELL, 'n6', 'board');
      await vi.waitFor(() => expect(post.mock.calls.map((c) => (c[0] as { type: string }).type)).toEqual(['ready', 'auth-state', 'sign-in']));
      expect(post.mock.calls.map((c) => (c[0] as { nonce: string }).nonce)).toEqual(['n6', 'n6', 'n6']);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(settled).toBe('pending');
      answer('n6', { outcome: 'leaving' });
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe('leaving');
    } finally {
      vi.useRealTimers();
    }
    pane.disconnect();
  });

  it('asks the shell that connected it to sign it in, and resolves with its answer', async () => {
    const post = spyPost();
    const pane = await started(post);
    connectFrom(SHELL, 'n5', 'board');
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const asked = pane.requestSignIn();
    expect(post.mock.calls.slice(1).map((c) => [c[0], c[1]])).toEqual([
      [{ boogy: PANE_PROTOCOL, type: 'sign-in', nonce: 'n5', payload: {} }, SHELL],
    ]);
    answer('n5', { outcome: 'busy', retryAfterMs: 2000 });
    await expect(asked).resolves.toEqual({ busy: 2000 });
    const again = pane.requestSignIn();
    answer('n5', { outcome: 'leaving' });
    await expect(again).resolves.toBe('leaving');
    pane.disconnect();
  });

  // An answer is heard only from the page that connected this one: its
  // window, its origin, and the nonce it connected with.
  it('takes an answer only from the shell that connected it', async () => {
    const post = spyPost();
    const pane = await started(post);
    connectFrom(SHELL, 'n5', 'board');
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    let settled: unknown = 'pending';
    void pane.requestSignIn().then((r) => { settled = r; });
    const result = { boogy: PANE_PROTOCOL, type: 'sign-in-result', nonce: 'n5', payload: { outcome: 'leaving' } };
    window.dispatchEvent(new MessageEvent('message', { origin: SHELL, source: {} as MessageEventSource, data: result }));
    fromShell(result, 'https://evil.example');
    fromShell({ ...result, nonce: 'n4' });
    await settle();
    expect(settled).toBe('pending');
    answer('n5', { outcome: 'already_signed_in' });
    await vi.waitFor(() => expect(settled).toBe('already_signed_in'));
    pane.disconnect();
  });

  it('a shell that never answers: unavailable once the wait is over', async () => {
    const post = spyPost();
    const pane = await started(post);
    connectFrom(SHELL, 'n5', 'board');
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      let settled: unknown = 'pending';
      void pane.requestSignIn().then((r) => { settled = r; });
      await vi.advanceTimersByTimeAsync(SIGN_IN_REPLY_TIMEOUT_MS - 1);
      expect(settled).toBe('pending');
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toBe('unavailable');
    } finally {
      vi.useRealTimers();
    }
    pane.disconnect();
  });

  // Asking again before the first is answered is the same request, not a second.
  it('one request at a time: asking again while unanswered asks nothing more', async () => {
    const post = spyPost();
    const pane = await started(post);
    connectFrom(SHELL, 'n5', 'board');
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const one = pane.requestSignIn();
    const two = pane.requestSignIn();
    expect(post.mock.calls.filter((c) => (c[0] as { type: string }).type === 'sign-in')).toHaveLength(1);
    answer('n5', { outcome: 'leaving' });
    await expect(one).resolves.toBe('leaving');
    await expect(two).resolves.toBe('leaving');
    pane.disconnect();
  });

  // A request is an event, not a state: one made before any shell connects is
  // not replayed later, so the app is told it went nowhere.
  it('asks nothing, and says so, while no shell is connected', async () => {
    const post = spyPost();
    const pane = await started(post);
    await expect(pane.requestSignIn()).resolves.toBe('unavailable');
    connectFrom(SHELL);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls.map((c) => (c[0] as { type: string }).type)).toEqual(['ready']);
    pane.disconnect();
    await expect(pane.requestSignIn()).resolves.toBe('unavailable');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('an unanswered request ends unavailable when the pane disconnects', async () => {
    const post = spyPost();
    const pane = await started(post);
    connectFrom(SHELL, 'n5', 'board');
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const asked = pane.requestSignIn();
    pane.disconnect();
    await expect(asked).resolves.toBe('unavailable');
  });

  it('an automatic pane stands aside when the app is already connected', async () => {
    const { connectAutoPane } = await import('./pane');
    const post = spyPost();
    const app = await started(post);
    expect(connectAutoPane({ service: 'squad' })).toBeNull();
    app.disconnect();
  });
});

describe('connectPane zoom', () => {
  const connectWith = (payload: Record<string, unknown>, nonce = 'z1') =>
    fromShell({ boogy: PANE_PROTOCOL, type: 'connect', nonce, payload: { shellOrigin: SHELL, host: 'board', ...payload } });
  const zoomFrame = (factor: unknown, nonce = 'z1', origin = SHELL) =>
    fromShell({ boogy: PANE_PROTOCOL, type: 'zoom', nonce, payload: { factor } }, origin);

  it('draws at the zoom the board connects with, and back at 1 once disconnected', async () => {
    const post = spyPost();
    const pane = await started(post);
    connectWith({ zoom: 1.5 });
    await vi.waitFor(() => expect(zoomState().host).toBe(1.5));
    pane.disconnect();
    expect(zoomState().host).toBe(1);
  });

  it("follows a zoom frame from its board, carrying that board's nonce", async () => {
    const post = spyPost();
    const pane = await started(post);
    connectWith({});
    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    zoomFrame(1.25);
    expect(zoomState().host).toBe(1.25);
    pane.disconnect();
  });

  it('ignores a zoom frame with another nonce, from another origin, or out of bounds', async () => {
    const post = spyPost();
    const pane = await started(post);
    connectWith({});
    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    zoomFrame(1.5, 'other');
    zoomFrame(1.5, 'z1', 'https://evil.example');
    zoomFrame(1000);
    zoomFrame(Number.NaN);
    expect(zoomState().host).toBe(1);
    pane.disconnect();
  });

  it('a connect with no zoom (an older board) draws at 1, even after a zoomed one', async () => {
    const post = spyPost();
    const pane = await started(post);
    connectWith({ zoom: 2 }, 'a');
    await vi.waitFor(() => expect(zoomState().host).toBe(2));
    connectWith({}, 'b');
    await vi.waitFor(() => expect(zoomState().host).toBe(1));
    pane.disconnect();
  });

  it('a connect whose zoom is out of bounds still connects, at 1', async () => {
    const post = spyPost();
    const pane = await started(post);
    connectWith({ zoom: 1000 });
    await vi.waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready' }), SHELL));
    expect(zoomState().host).toBe(1);
    pane.disconnect();
  });
});
