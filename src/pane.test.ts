import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { PANE_PROTOCOL } from './internal/pane-protocol';
import { loadPlatformConfig } from './internal/platform-config';
import { connectPane } from './pane';
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
afterEach(() => vi.restoreAllMocks());

function fromShell(data: unknown, origin = SHELL) {
  window.dispatchEvent(new MessageEvent('message', { origin, source: window.parent, data }));
}
function connectFrom(shellOrigin: string, nonce = 'n1') {
  fromShell({ boogy: PANE_PROTOCOL, type: 'connect', nonce, payload: { shellOrigin } }, shellOrigin);
}
const settle = () => new Promise((r) => setTimeout(r, 0));
// A real browser drops a message whose target origin does not match the
// receiver; the test DOM throws instead, and here the test page is its own
// parent. So the send is recorded, not performed.
const spyPost = () => vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
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
    fromShell({ boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n1', payload: { shellOrigin: SHELL } }, 'https://evil.example');
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

  it('ignores a connect that does not come from its parent window', async () => {
    const post = spyPost();
    const pane = await started(post);
    window.dispatchEvent(new MessageEvent('message', {
      origin: SHELL, source: {} as MessageEventSource,
      data: { boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n1', payload: { shellOrigin: SHELL } },
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
});

describe('connectPane zoom', () => {
  const connectWith = (payload: Record<string, unknown>, nonce = 'z1') =>
    fromShell({ boogy: PANE_PROTOCOL, type: 'connect', nonce, payload: { shellOrigin: SHELL, ...payload } });
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
