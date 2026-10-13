import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { loadPlatformConfig } from './platform-config';
import { upgradeUrl, runUpgradeFlow } from './upgrade-flow';
import { authOrigin } from './urls';

beforeAll(async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
    JSON.stringify({ authOrigin: 'https://auth.boogy.ai', owner: 'alice', shellOrigins: [], service: 'notes' }), { status: 200 }));
  await loadPlatformConfig();
  vi.restoreAllMocks();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('upgradeUrl', () => {
  it('names the service, the target and the asking origin', () => {
    const u = new URL(upgradeUrl({ serviceId: 'my app', to: '0.2.0+b' }));
    expect(u.origin + u.pathname).toBe(`${authOrigin()}/boogy/upgrade`);
    expect(u.searchParams.get('service')).toBe('my app');
    expect(u.searchParams.get('to')).toBe('0.2.0+b');
    expect(u.searchParams.get('app_origin')).toBe(location.origin);
    expect(u.searchParams.get('mode')).toBe('popup');
  });
});

describe('runUpgradeFlow', () => {
  const popup = () => vi.spyOn(window, 'open').mockReturnValue({ closed: false, close: vi.fn() } as unknown as Window);
  const say = (origin: string, data: unknown) => window.dispatchEvent(new MessageEvent('message', { origin, data }));

  it('rejects popup_blocked when the window cannot open', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    await expect(runUpgradeFlow({ serviceId: 's', to: '1.0.0' })).rejects.toMatchObject({ code: 'popup_blocked' });
  });

  it('ignores a message from any other origin', async () => {
    popup();
    const p = runUpgradeFlow({ serviceId: 's', to: '1.0.0' });
    const seen = vi.fn();
    p.then(seen, seen);
    say('https://evil.example', { boogy: 'upgrade_done', serviceId: 's', version: '1.0.0' });
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).not.toHaveBeenCalled();
    say(authOrigin(), { boogy: 'upgrade_cancelled' });
    await p;
  });

  it('resolves upgraded from the platform origin', async () => {
    popup();
    const p = runUpgradeFlow({ serviceId: 's', to: '1.0.0' });
    say(authOrigin(), { boogy: 'upgrade_done', serviceId: 's', version: '1.0.0' });
    await expect(p).resolves.toEqual({ outcome: 'upgraded', version: '1.0.0' });
  });

  it('resolves cancelled', async () => {
    popup();
    const p = runUpgradeFlow({ serviceId: 's', to: '1.0.0' });
    say(authOrigin(), { boogy: 'upgrade_cancelled' });
    await expect(p).resolves.toEqual({ outcome: 'cancelled' });
  });
});
