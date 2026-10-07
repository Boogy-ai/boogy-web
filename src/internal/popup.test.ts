import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { awaitPopup } from './popup';
import { BoogyError } from '../errors';

const APP_ORIGIN = 'https://alice.boogy.ai';
const AUTH_URL = 'https://auth.boogy.ai/authorize?foo=1';

// A small popup flow built on awaitPopup, the way the install flow drives it:
// done resolves, cancelled rejects consent_denied.
function runAuthFlow({ authorizeUrl, appOrigin }: { authorizeUrl: string; appOrigin: string; mode: 'popup' }): Promise<void> {
  return awaitPopup<void>({
    url: authorizeUrl,
    name: 'boogy_sso',
    origin: appOrigin,
    blocked: () => new BoogyError('popup_blocked', 'The sign-in popup was blocked by the browser.'),
    aborted: () => new BoogyError('sign_in_aborted', 'The sign-in popup was closed before completion.'),
    decide(data) {
      const boogy = (data as { boogy?: string } | null)?.boogy;
      if (boogy === 'sso_done') return { value: undefined };
      if (boogy === 'sso_cancelled') return { error: new BoogyError('consent_denied', 'The user cancelled the sign-in.') };
      return null;
    },
  });
}

describe('awaitPopup', () => {
  let fakePopup: { closed: boolean; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    fakePopup = { closed: false, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(fakePopup as unknown as Window);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('resolves when the callback postMessages sso_done from the app origin', async () => {
    const p = runAuthFlow({ authorizeUrl: AUTH_URL, appOrigin: APP_ORIGIN, mode: 'popup' });
    window.dispatchEvent(
      new MessageEvent('message', { origin: APP_ORIGIN, data: { boogy: 'sso_done' } }),
    );
    await expect(p).resolves.toBeUndefined();
    expect(window.open).toHaveBeenCalled();
  });

  it('rejects popup_blocked when window.open returns null', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    await expect(
      runAuthFlow({ authorizeUrl: AUTH_URL, appOrigin: APP_ORIGIN, mode: 'popup' }),
    ).rejects.toMatchObject({ code: 'popup_blocked' });
  });

  it('rejects consent_denied on sso_cancelled from app origin', async () => {
    const p = runAuthFlow({ authorizeUrl: AUTH_URL, appOrigin: APP_ORIGIN, mode: 'popup' });
    window.dispatchEvent(
      new MessageEvent('message', { origin: APP_ORIGIN, data: { boogy: 'sso_cancelled' } }),
    );
    await expect(p).rejects.toMatchObject({ code: 'consent_denied' });
  });

  it('ignores postMessage from a foreign origin; then rejects sign_in_aborted when popup closes', async () => {
    vi.useFakeTimers();

    // Attach the rejection handler BEFORE runAllTimersAsync fires the poll.
    const p = runAuthFlow({ authorizeUrl: AUTH_URL, appOrigin: APP_ORIGIN, mode: 'popup' });
    const settled = expect(p).rejects.toMatchObject({ code: 'sign_in_aborted' });

    // Dispatch a message from a foreign origin — must be ignored.
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example.com',
        data: { boogy: 'sso_done' },
      }),
    );

    // Simulate the popup being closed without any valid sso message.
    fakePopup.closed = true;
    await vi.runAllTimersAsync();

    await settled;
  });

  it('cleans up the message listener after resolution', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const p = runAuthFlow({ authorizeUrl: AUTH_URL, appOrigin: APP_ORIGIN, mode: 'popup' });
    window.dispatchEvent(
      new MessageEvent('message', { origin: APP_ORIGIN, data: { boogy: 'sso_done' } }),
    );
    await p;

    // The listener registered for 'message' must have been removed.
    const addedHandlers = addSpy.mock.calls.filter((c) => c[0] === 'message').map((c) => c[1]);
    const removedHandlers = removeSpy.mock.calls
      .filter((c) => c[0] === 'message')
      .map((c) => c[1]);
    for (const h of addedHandlers) {
      expect(removedHandlers).toContain(h);
    }
  });

  it('opens the popup with the correct URL and popup features', () => {
    runAuthFlow({ authorizeUrl: AUTH_URL, appOrigin: APP_ORIGIN, mode: 'popup' });
    expect(window.open).toHaveBeenCalledWith(
      AUTH_URL,
      'boogy_sso',
      expect.stringContaining('popup'),
    );
  });
});
