// A pane names the service its ORIGIN serves, as the platform says
// (`/boogy/config`'s `service`), not whatever id the app was written with: an
// app provisioned under another id (`pollster-e2e` from a module written as
// `pollster`) still connects to the board that frames it.
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { PANE_PROTOCOL } from './internal/pane-protocol';
import { loadPlatformConfig } from './internal/platform-config';
import { connectPane } from './pane';

const SHELL = 'https://boards.example';

beforeAll(async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ authOrigin: 'https://auth.example', owner: 'dave', service: 'pollster-e2e', shellOrigins: [SHELL] }), { status: 200 }),
  );
  await loadPlatformConfig();
  vi.restoreAllMocks();
});
const realParent = window.parent;
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
const connectFrom = (nonce = 'n1') => window.dispatchEvent(new MessageEvent('message', {
  origin: SHELL, source: window.parent, data: { boogy: PANE_PROTOCOL, type: 'connect', nonce, payload: { shellOrigin: SHELL, host: 'board' } },
}));

describe("connectPane names its origin's service", () => {
  it('says hello and ready as the service its origin serves, whatever id the app passed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const post = spyPost();
    const pane = connectPane({ service: 'pollster' });
    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toMatchObject({ type: 'hello', payload: { service: 'pollster-e2e' } });
    post.mockClear();
    connectFrom();
    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toMatchObject({ type: 'ready', payload: { service: 'pollster-e2e' } });
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('pollster-e2e'))).toHaveLength(1);
    pane.disconnect();
  });

  it('needs no service from the app at all', async () => {
    const post = spyPost();
    const pane = connectPane({});
    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toMatchObject({ type: 'hello', payload: { service: 'pollster-e2e' } });
    pane.disconnect();
  });
});
