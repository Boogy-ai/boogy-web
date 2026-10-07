import { describe, it, expect, vi, afterEach } from 'vitest';
import { PANE_PROTOCOL } from './internal/pane-protocol';

const SHELL = 'https://dave.example';

afterEach(() => vi.restoreAllMocks());

async function fresh(config: object) {
  vi.resetModules();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(config), { status: 200 }));
  return import('./pane-auto');
}

// A window whose parent is someone else, which is what "framed" means.
function framedWindow(): Window {
  return new Proxy(window, { get: (t, k) => (k === 'parent' ? { postMessage: vi.fn() } : Reflect.get(t, k)) }) as Window;
}

describe('startAutoPane', () => {
  afterEach(() => {
    // The pane slot lives on `globalThis` and survives `vi.resetModules()`.
    // Disconnect whatever holds it first — otherwise its listener and history
    // patch stay live for the rest of the file — then clear the slot itself so
    // one test's pane can't be mistaken for another's.
    const slot = (globalThis as Record<symbol, { disconnect(): void } | undefined>)[Symbol.for('boogy.pane/v1')];
    slot?.disconnect();
    delete (globalThis as Record<symbol, unknown>)[Symbol.for('boogy.pane/v1')];
  });

  it('does nothing at the top level', async () => {
    const { startAutoPane } = await fresh({ authOrigin: 'https://a.example', owner: 'dave', shellOrigins: [SHELL], service: 'chats', mount: '/' });
    expect(await startAutoPane(window)).toBe(false);
  });

  it('does nothing where the platform names no service', async () => {
    const { startAutoPane } = await fresh({ authOrigin: 'https://a.example', owner: 'dave', shellOrigins: [SHELL] });
    expect(await startAutoPane(framedWindow())).toBe(false);
  });

  // `connectPane`'s internals read `window.parent` and `window.addEventListener`
  // directly, never through a passed-in window — so a Proxy stand-in for the
  // window argument alone cannot make them see a framed page: they would still
  // post to (and listen against) the REAL top-level `window.parent`, which
  // disagrees with whatever the Proxy claims. So this test frames the page for
  // real, the way `pane.test.ts` and `pane-history.test.ts` do: it overrides the
  // actual `window.parent` getter and drives `startAutoPane` with the real
  // `window`, restoring the getter afterwards.
  it('reports every history change as the location', async () => {
    const { startAutoPane } = await fresh({ authOrigin: 'https://a.example', owner: 'dave', shellOrigins: [SHELL], service: 'chats', mount: '/' });
    const realParent = window.parent;
    const fakeParent = { postMessage: vi.fn() };
    Object.defineProperty(window, 'parent', { configurable: true, get: () => fakeParent });
    try {
      expect(await startAutoPane(window)).toBe(true);
      // The patched history reports through the pane; drive it and read the
      // frame the pane sends once connected.
      window.dispatchEvent(new MessageEvent('message', {
        origin: SHELL, source: fakeParent as unknown as MessageEventSource,
        data: { boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n1', payload: { shellOrigin: SHELL, host: 'board' } },
      }));
      await vi.waitFor(() => expect(fakeParent.postMessage).toHaveBeenCalled());
      window.history.pushState({}, '', '/c/x?q=1');
      await vi.waitFor(() =>
        expect(
          fakeParent.postMessage.mock.calls.some(
            (c) => (c[0] as { type: string }).type === 'location' && (c[0] as { payload: { path: string } }).payload.path === '/c/x?q=1',
          ),
        ).toBe(true),
      );
      // Reset the address while `window.parent` is still the fake — the pane's
      // own history patch reports on every change, and once the real parent is
      // restored below that report would be a REAL cross-origin `postMessage`,
      // which the browser (rightly) refuses.
      history.replaceState(null, '', '/');
    } finally {
      Object.defineProperty(window, 'parent', { configurable: true, get: () => realParent });
    }
  });
});
