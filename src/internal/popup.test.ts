import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runAuthFlow } from './popup';

const APP_ORIGIN = 'https://alice.boogy.ai';
const AUTH_URL = 'https://auth.boogy.ai/authorize?foo=1';

describe('runAuthFlow — popup mode', () => {
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

describe('runAuthFlow — redirect mode', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('persists pending state to sessionStorage and navigates', () => {
    // We can't easily test location.assign in happy-dom; just verify sessionStorage is set
    // and that the function is called without throwing.
    const assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => {});

    runAuthFlow({ authorizeUrl: AUTH_URL, appOrigin: APP_ORIGIN, mode: 'redirect' });

    const raw = sessionStorage.getItem('boogy_sso_pending');
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!);
    expect(stored).toHaveProperty('returnTo');
    expect(assignSpy).toHaveBeenCalledWith(AUTH_URL);
  });

  it('returns a never-resolving promise (the page navigates away)', async () => {
    vi.spyOn(window.location, 'assign').mockImplementation(() => {});

    const flowPromise = runAuthFlow({
      authorizeUrl: AUTH_URL,
      appOrigin: APP_ORIGIN,
      mode: 'redirect',
    });

    // The redirect-flow promise must stay pending: racing it against an
    // already-resolved sentinel must yield the sentinel, never the flow.
    const winner = await Promise.race([flowPromise, Promise.resolve('x')]);
    expect(winner).toBe('x');
  });
});

describe('resumeRedirect', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('returns false when no pending state exists', async () => {
    const { resumeRedirect } = await import('./popup');
    expect(resumeRedirect()).toBe(false);
  });

  it('returns true and clears sessionStorage when pending state exists', async () => {
    const { resumeRedirect } = await import('./popup');
    sessionStorage.setItem(
      'boogy_sso_pending',
      JSON.stringify({ returnTo: 'https://alice.boogy.ai/app' }),
    );
    expect(resumeRedirect()).toBe(true);
    expect(sessionStorage.getItem('boogy_sso_pending')).toBeNull();
  });
});
