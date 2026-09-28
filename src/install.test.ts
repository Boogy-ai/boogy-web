import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { Boogy } from './boogy';
import { loadPlatformConfig } from './internal/platform-config';

const AUTH = 'https://auth.boogy.ai';
const APP = 'https://alice.boogy.ai';
const chess = { owner: 'ann', name: 'chess', version: '1.2.0' };

beforeAll(async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ authOrigin: AUTH, owner: 'alice', shellOrigins: [] }), { status: 200 }),
  );
  await loadPlatformConfig();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubLocation(extra: Record<string, unknown> = {}) {
  const loc = { origin: APP, pathname: '/b/one', search: '', href: `${APP}/b/one`, assign: vi.fn(), ...extra };
  vi.stubGlobal('location', loc);
  return loc;
}

function openPopup() {
  const popup = { closed: false, close: vi.fn() };
  const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  return { popup, open };
}

const post = (origin: string, data: unknown) => window.dispatchEvent(new MessageEvent('message', { origin, data }));

describe('Boogy.install — popup', () => {
  it('opens the platform install page with the module, the suggested name and this origin', async () => {
    stubLocation();
    const { open } = openPopup();
    const p = new Boogy().install({ module: chess, serviceId: 'chess-2' });
    const url = new URL(open.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe(`${AUTH}/install`);
    expect(url.searchParams.get('module')).toBe('boogy://ann/modules/chess@1.2.0');
    expect(url.searchParams.get('service_id')).toBe('chess-2');
    expect(url.searchParams.get('app_origin')).toBe(APP);
    expect(url.searchParams.get('mode')).toBe('popup');
    post(AUTH, { boogy: 'install_done', serviceId: 'chess-2', url: `${APP}/chess-2` });
    await expect(p).resolves.toEqual({ serviceId: 'chess-2', url: `${APP}/chess-2` });
  });

  it('believes only the platform: an install_done from the app origin or anywhere else is ignored', async () => {
    vi.useFakeTimers();
    stubLocation();
    const { popup } = openPopup();
    const p = new Boogy().install({ module: chess });
    const settled = expect(p).rejects.toMatchObject({ code: 'install_aborted' });
    post(APP, { boogy: 'install_done', serviceId: 'x', url: 'u' });
    post('https://evil.example', { boogy: 'install_done', serviceId: 'x', url: 'u' });
    popup.closed = true;
    await vi.runAllTimersAsync();
    await settled;
  });

  it('rejects install_cancelled when the person cancels', async () => {
    stubLocation();
    openPopup();
    const p = new Boogy().install({ module: chess });
    post(AUTH, { boogy: 'install_cancelled' });
    await expect(p).rejects.toMatchObject({ code: 'install_cancelled' });
  });

  it('ignores a done message that is missing its fields', async () => {
    vi.useFakeTimers();
    stubLocation();
    const { popup } = openPopup();
    const p = new Boogy().install({ module: chess });
    const settled = expect(p).rejects.toMatchObject({ code: 'install_aborted' });
    post(AUTH, { boogy: 'install_done' });
    popup.closed = true;
    await vi.runAllTimersAsync();
    await settled;
  });

  it('rejects popup_blocked when the browser blocks the window', async () => {
    stubLocation();
    vi.spyOn(window, 'open').mockReturnValue(null);
    await expect(new Boogy().install({ module: chess })).rejects.toMatchObject({ code: 'popup_blocked' });
  });
});

describe('Boogy.install — one at a time', () => {
  it('a second install supersedes the first: the first rejects and never takes the second one\'s answer', async () => {
    stubLocation();
    openPopup();
    const boogy = new Boogy();
    const first = boogy.install({ module: chess });
    const firstSettled = expect(first).rejects.toMatchObject({ code: 'install_aborted' });
    const second = boogy.install({ module: { owner: 'bo', name: 'go', version: '1.0.0' } });
    post(AUTH, { boogy: 'install_done', serviceId: 'go', url: `${APP}/go` });
    await firstSettled;
    await expect(second).resolves.toEqual({ serviceId: 'go', url: `${APP}/go` });
  });
});

describe('Boogy.install — redirect', () => {
  it('navigates to the install page with where to come back to', () => {
    const loc = stubLocation({ search: '?x=1' });
    void new Boogy({ authMode: 'redirect' }).install({ module: chess });
    const url = new URL(loc.assign.mock.calls[0][0] as string);
    expect(url.searchParams.get('mode')).toBe('redirect');
    expect(url.searchParams.get('redirect')).toBe('/b/one?x=1');
  });

  it('sends a path, never something a browser reads as another host', () => {
    const loc = stubLocation({ pathname: '//evil.com/x' });
    void new Boogy({ authMode: 'redirect' }).install({ module: chess });
    expect(new URL(loc.assign.mock.calls[0][0] as string).searchParams.get('redirect')).toBe('/evil.com/x');
  });

  it('takeInstalled() reads boogy_installed once and removes it from the address', () => {
    const replace = vi.spyOn(history, 'replaceState').mockImplementation(() => {});
    stubLocation({ search: '?x=1&boogy_installed=chess', href: `${APP}/b/one?x=1&boogy_installed=chess` });
    expect(Boogy.takeInstalled()).toBe('chess');
    expect(replace.mock.calls[0][2]).toBe('/b/one?x=1');
  });

  it('takeInstalled() is null when nothing was installed', () => {
    stubLocation();
    expect(Boogy.takeInstalled()).toBeNull();
  });
});
