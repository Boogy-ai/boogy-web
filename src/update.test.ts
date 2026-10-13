import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { checkForUpdate, installUpdate, type Update } from './update';
import * as flow from './internal/upgrade-flow';
import { connectPane, SIGN_IN_REPLY_TIMEOUT_MS, type PaneHandle } from './pane';
import { PANE_PROTOCOL } from './internal/pane-protocol';
import { loadPlatformConfig } from './internal/platform-config';

afterEach(() => { vi.restoreAllMocks(); });

const wire = {
  service_id: 'wordle',
  current: '0.1.0',
  update: {
    version: '0.2.0', bump: 'minor', published_at: '2026-10-01T00:00:00Z', notes: 'Faster.',
    items: [{ kind: 'capability', label: 'Reach other websites', detail: 'api.example.com', tone: 'attention' }],
  },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const pane = (over: Partial<PaneHandle> = {}) =>
  ({ boardShowsUpdates: false, requestUpgrade: vi.fn(async () => 'opened' as const), ...over }) as unknown as PaneHandle;
const update: Update = {
  serviceId: 'wordle', current: '0.1.0', version: '0.2.0', bump: 'minor', publishedAt: 'x', notes: null, items: [],
};

describe('checkForUpdate', () => {
  it('reads /boogy/update on the same origin and maps it to camelCase', async () => {
    const fetch = vi.fn(async () => json(wire));
    const got = await checkForUpdate({ fetch: fetch as unknown as typeof globalThis.fetch });
    expect(fetch).toHaveBeenCalledWith('/boogy/update', expect.objectContaining({ credentials: 'same-origin' }));
    expect(got).toEqual({
      serviceId: 'wordle', current: '0.1.0', version: '0.2.0', bump: 'minor', publishedAt: '2026-10-01T00:00:00Z', notes: 'Faster.',
      items: [{ kind: 'capability', label: 'Reach other websites', detail: 'api.example.com', tone: 'attention' }],
    });
  });

  it('makes no request when the board shows the pane its update', async () => {
    const fetch = vi.fn(async () => json(wire));
    await expect(checkForUpdate({ pane: pane({ boardShowsUpdates: true }), fetch: fetch as unknown as typeof globalThis.fetch })).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks the platform when the pane is not shown updates by its board', async () => {
    const fetch = vi.fn(async () => json(wire));
    await checkForUpdate({ pane: pane(), fetch: fetch as unknown as typeof globalThis.fetch });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('is null when there is no update, for a non-owner, on a refusal, a bad body, or a failed request', async () => {
    const f = (r: () => Promise<Response>) => ({ fetch: vi.fn(r) as unknown as typeof globalThis.fetch });
    await expect(checkForUpdate(f(async () => json({ service_id: 'wordle', current: '0.2.0', update: null })))).resolves.toBeNull();
    await expect(checkForUpdate(f(async () => json({ service_id: null, current: null, update: null })))).resolves.toBeNull();
    await expect(checkForUpdate(f(async () => json({}, 403)))).resolves.toBeNull();
    await expect(checkForUpdate(f(async () => new Response('nope', { status: 200 })))).resolves.toBeNull();
    await expect(checkForUpdate(f(async () => { throw new Error('down'); }))).resolves.toBeNull();
    await expect(checkForUpdate(f(async () => json({ service_id: 'w', current: '1.0.0', update: { version: 1 } })))).resolves.toBeNull();
  });
});

describe('installUpdate', () => {
  it('asks the board when it shows the pane its update', async () => {
    const upgrade = vi.spyOn(flow, 'runUpgradeFlow');
    const p = pane({ boardShowsUpdates: true, requestUpgrade: vi.fn(async () => 'busy' as const) });
    await expect(installUpdate(update, { pane: p })).resolves.toBe('busy');
    expect(p.requestUpgrade).toHaveBeenCalledTimes(1);
    expect(upgrade).not.toHaveBeenCalled();
  });

  it('opens the platform confirmation when the board cannot take it, and when there is no board', async () => {
    const upgrade = vi.spyOn(flow, 'runUpgradeFlow').mockResolvedValue({ outcome: 'cancelled' });
    const p = pane({ boardShowsUpdates: true, requestUpgrade: vi.fn(async () => 'unavailable' as const) });
    await expect(installUpdate(update, { pane: p })).resolves.toBe('cancelled');
    await expect(installUpdate(update)).resolves.toBe('cancelled');
    await expect(installUpdate(update, { pane: pane() })).resolves.toBe('cancelled');
    expect(upgrade).toHaveBeenCalledWith({ serviceId: 'wordle', to: '0.2.0' });
    expect(upgrade).toHaveBeenCalledTimes(3);
  });

  it('reloads the page once it has been updated', async () => {
    vi.spyOn(flow, 'runUpgradeFlow').mockResolvedValue({ outcome: 'upgraded', version: '0.2.0' });
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    try {
      await expect(installUpdate(update)).resolves.toBe('upgraded');
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not reload on a cancel, and lets a blocked window reject', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    try {
      vi.spyOn(flow, 'runUpgradeFlow').mockResolvedValueOnce({ outcome: 'cancelled' });
      await installUpdate(update);
      vi.spyOn(flow, 'runUpgradeFlow').mockRejectedValueOnce(new Error('popup_blocked'));
      await expect(installUpdate(update)).rejects.toThrow('popup_blocked');
      expect(reload).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// The documented pattern calls `checkForUpdate({ pane })` right after
// `connectPane`, before the board framing the app has connected. It must wait
// for that connection (bounded) before deciding the board does not show updates.
describe('checkForUpdate in a frame, before its board connects', () => {
  const SHELL = 'https://boards.example';
  const realParent = window.parent;
  beforeAll(async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ authOrigin: 'https://auth.example', owner: 'foo', shellOrigins: [SHELL] }), { status: 200 }),
    );
    await loadPlatformConfig();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'parent', { configurable: true, get: () => realParent });
    const slot = (globalThis as Record<symbol, { disconnect(): void } | undefined>)[Symbol.for('boogy.pane/v1')];
    slot?.disconnect();
  });
  /** A pane in a frame whose parent records what it is sent. */
  async function framedPane() {
    const parent = { postMessage: vi.fn() };
    Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
    const p = connectPane({ service: 'wordle' });
    await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalled()); // its hello
    return p;
  }
  const connect = (payload: Record<string, unknown>) =>
    window.dispatchEvent(new MessageEvent('message', {
      origin: SHELL, source: window.parent,
      data: { boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n1', payload: { shellOrigin: SHELL, host: 'board', ...payload } },
    }));
  const fetcher = () => vi.fn(async () => json(wire));

  it("asks nobody when the board's connect, arriving after the call, says it shows updates", async () => {
    const p = await framedPane();
    const fetch = fetcher();
    const checked = checkForUpdate({ pane: p, fetch: fetch as unknown as typeof globalThis.fetch });
    connect({ updates: 'board' });
    await expect(checked).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks the platform at once when the board that connects does not show updates', async () => {
    const p = await framedPane();
    const fetch = fetcher();
    const checked = checkForUpdate({ pane: p, fetch: fetch as unknown as typeof globalThis.fetch });
    connect({});
    await expect(checked).resolves.toMatchObject({ version: '0.2.0' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('asks the platform once no board has connected within the reply timeout', async () => {
    const p = await framedPane();
    vi.useFakeTimers();
    const fetch = fetcher();
    let done = false;
    const checked = checkForUpdate({ pane: p, fetch: fetch as unknown as typeof globalThis.fetch }).then((u) => { done = true; return u; });
    await vi.advanceTimersByTimeAsync(SIGN_IN_REPLY_TIMEOUT_MS - 1);
    expect(fetch).not.toHaveBeenCalled();
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(checked).resolves.toMatchObject({ version: '0.2.0' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not wait on a page that is not framed', async () => {
    const p = connectPane({ service: 'wordle' });
    vi.useFakeTimers();
    const fetch = fetcher();
    const checked = checkForUpdate({ pane: p, fetch: fetch as unknown as typeof globalThis.fetch });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(checked).resolves.toMatchObject({ version: '0.2.0' });
  });
});
