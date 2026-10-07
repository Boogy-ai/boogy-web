// Every service is served at its own address, a label of its own. Where it is
// framed — a pane on a board — the page framing it signs it in: the SDK's
// sign-in calls first look at the session this origin already holds, only a
// signed-out one asks that page, and when no such page is connected they
// refuse visibly; a frame never opens or navigates to a sign-in. Shown alone,
// the label is a page of its own and signs in by the platform's classic flow,
// which starts at the label's own `/boogy/signin`.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PANE_PROTOCOL } from './internal/pane-protocol';

const SHELL = 'https://boards.boogy.app';
const LABEL = 'https://chats-k3v9.boogy.app';
const APP_ORIGIN_CONFIG = {
  authOrigin: 'https://auth.boogy.app', owner: 'dave', shellOrigins: [SHELL], service: 'chats',
};
const SIGNED_IN = { pairwiseId: 'pw_1', displayName: null, avatarUrl: null };
const SLOT = Symbol.for('boogy.pane/v1');

/** A fresh SDK against a platform that answers `/boogy/config` with `config`
 *  and `/boogy/me` with `me` (null: signed out). Records every URL asked. */
async function fresh(config: object, me: unknown = null, meStatus = 200) {
  vi.resetModules();
  const asked: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (u) => {
    const url = String(u);
    asked.push(url);
    if (url.includes('/boogy/config')) return new Response(JSON.stringify(config), { status: 200 });
    if (url.includes('/boogy/me') && meStatus === 0) throw new TypeError('network');
    if (url.includes('/boogy/me')) return new Response(JSON.stringify(me), { status: meStatus });
    return new Response('', { status: 404 });
  });
  const platform = await import('./internal/platform-config');
  await platform.loadPlatformConfig();
  return { asked, ...(await import('./boogy')), ...(await import('./pane')), ...(await import('./errors')) };
}

const realParent = window.parent;
/** Frame the page for real (`connectPane` reads `window.parent` itself), under a
 *  shell that answers every sign-in request with `answer`. */
function frame(answer: object = { outcome: 'leaving' }): { postMessage: ReturnType<typeof vi.fn> } {
  const parent = {
    postMessage: vi.fn((data: { type: string; nonce: string }) => {
      if (data.type !== 'sign-in') return;
      queueMicrotask(() => window.dispatchEvent(new MessageEvent('message', {
        origin: SHELL, source: parent as unknown as MessageEventSource,
        data: { boogy: PANE_PROTOCOL, type: 'sign-in-result', nonce: data.nonce, payload: answer },
      })));
    }),
  };
  Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
  return parent;
}

function connectFromShell(parent: object, host: 'board') {
  window.dispatchEvent(new MessageEvent('message', {
    origin: SHELL, source: parent as MessageEventSource,
    data: { boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n1', payload: { shellOrigin: SHELL, host } },
  }));
}

const sent = (parent: { postMessage: ReturnType<typeof vi.fn> }) =>
  parent.postMessage.mock.calls.map((c) => c[0] as { type: string; payload: unknown });
const signIns = (parent: { postMessage: ReturnType<typeof vi.fn> }) => sent(parent).filter((f) => f.type === 'sign-in');

afterEach(() => {
  (globalThis as Record<symbol, { disconnect?(): void } | undefined>)[SLOT]?.disconnect?.();
  delete (globalThis as Record<symbol, unknown>)[SLOT];
  Object.defineProperty(window, 'parent', { configurable: true, get: () => realParent });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('signing in a service on its own label', () => {
  it('connectApp, signed out, tells the page framing it so and asks it; it opens nothing', async () => {
    const { Boogy, connectPane, asked } = await fresh(APP_ORIGIN_CONFIG);
    const parent = frame();
    vi.stubGlobal('top', {});
    const open = vi.spyOn(window, 'open');
    const pane = connectPane({ service: 'chats' });
    connectFromShell(parent, 'board');
    await vi.waitFor(() => expect(pane.host).toBe('board'));

    await new Boogy().connectApp('dave/chats');
    expect(asked).toContain('/boogy/me');
    const after = sent(parent).slice(sent(parent).findIndex((f) => f.type === 'ready') + 1);
    expect(after).toEqual([
      { boogy: PANE_PROTOCOL, type: 'auth-state', nonce: 'n1', payload: { signedIn: false } },
      { boogy: PANE_PROTOCOL, type: 'sign-in', nonce: 'n1', payload: {} },
    ]);
    expect(open).not.toHaveBeenCalled();
  });

  it('signIn, signed out, asks the page framing it too', async () => {
    const { Boogy, connectPane } = await fresh(APP_ORIGIN_CONFIG);
    const parent = frame();
    vi.stubGlobal('top', {});
    const pane = connectPane({ service: 'chats' });
    connectFromShell(parent, 'board');
    await vi.waitFor(() => expect(pane.host).toBe('board'));

    await new Boogy().signIn();
    expect(signIns(parent)).toHaveLength(1);
  });

  // An app that calls these on every load must not send a signed-in person
  // round the sign-in trip on every load: a session here is the answer.
  it('signed in already, signIn and connectApp resolve and ask nothing', async () => {
    const { Boogy, connectPane } = await fresh(APP_ORIGIN_CONFIG, SIGNED_IN);
    const parent = frame();
    vi.stubGlobal('top', {});
    const pane = connectPane({ service: 'chats' });
    connectFromShell(parent, 'board');
    await vi.waitFor(() => expect(pane.host).toBe('board'));

    await new Boogy().signIn();
    await new Boogy().connectApp('dave/chats');
    expect(signIns(parent)).toHaveLength(0);
    expect(sent(parent).filter((f) => f.type === 'auth-state')).toHaveLength(0);
  });

  // A session check that fails is not a session: an answer other than 200
  // (whatever its body says), or none at all, reads as signed out — so the
  // page framing the app is told so and asked, never skipped.
  it.each([401, 500, 0])('a session check answered %i reads as signed out, and asks the page framing it', async (meStatus) => {
    const { Boogy, connectPane, asked } = await fresh(APP_ORIGIN_CONFIG, SIGNED_IN, meStatus);
    const parent = frame();
    vi.stubGlobal('top', {});
    const pane = connectPane({ service: 'chats' });
    connectFromShell(parent, 'board');
    await vi.waitFor(() => expect(pane.host).toBe('board'));

    await new Boogy().signIn();
    expect(asked).toContain('/boogy/me');
    expect(sent(parent).filter((f) => f.type === 'auth-state').map((f) => f.payload)).toEqual([{ signedIn: false }]);
    expect(signIns(parent)).toHaveLength(1);
  });

  it('a sign-in that went too recently rejects with sign_in_busy', async () => {
    const { Boogy, connectPane } = await fresh(APP_ORIGIN_CONFIG);
    const parent = frame({ outcome: 'busy', retryAfterMs: 12_000 });
    vi.stubGlobal('top', {});
    const pane = connectPane({ service: 'chats' });
    connectFromShell(parent, 'board');
    await vi.waitFor(() => expect(pane.host).toBe('board'));

    await expect(new Boogy().connectApp('dave/chats')).rejects.toMatchObject({ code: 'sign_in_busy' });
  });

  // A label serves one app, framed or not: a framed sign-in named for
  // another app is refused before the board is asked.
  it('framed, a sign-in for another app is refused, and the board is not asked', async () => {
    const { Boogy, connectPane } = await fresh(APP_ORIGIN_CONFIG);
    const parent = frame();
    vi.stubGlobal('top', {});
    const pane = connectPane({ service: 'chats' });
    connectFromShell(parent, 'board');
    await vi.waitFor(() => expect(pane.host).toBe('board'));
    await expect(new Boogy().connectApp('dave/notes')).rejects.toMatchObject({ code: 'app_not_found', app: 'dave/notes' });
    expect(signIns(parent)).toHaveLength(0);
  });

  // Framed, but nothing framing it has connected: there is no page to ask, so
  // the call says so rather than trying a sign-in the platform would refuse.
  it('framed with no page connected, it refuses with sign_in_unavailable and opens nothing', async () => {
    const { Boogy, connectPane, BoogyError } = await fresh(APP_ORIGIN_CONFIG);
    const parent = frame();
    vi.stubGlobal('top', {});
    const open = vi.spyOn(window, 'open');
    connectPane({ service: 'chats' });

    const err = await new Boogy().connectApp('dave/chats').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BoogyError);
    expect((err as InstanceType<typeof BoogyError>).code).toBe('sign_in_unavailable');
    expect(signIns(parent)).toHaveLength(0);
    expect(open).not.toHaveBeenCalled();
  });

  // Another copy of the SDK may hold the window's one pane connection: one this
  // copy cannot ask is no page to ask.
  it('a pane connection this SDK cannot ask is unavailable', async () => {
    const { Boogy, requestSignInFromFramer } = await fresh(APP_ORIGIN_CONFIG);
    vi.stubGlobal('top', {});
    (globalThis as Record<symbol, unknown>)[SLOT] = { kind: 'app', disconnect() {} };
    await expect(requestSignInFromFramer()).resolves.toBe('unavailable');
    await expect(new Boogy().connectApp('dave/chats')).rejects.toMatchObject({ code: 'sign_in_unavailable' });
  });

  // Shown alone on its own label (the platform names its one service there),
  // signed out: the label's own `/boogy/signin` starts the classic sign-in for
  // that one service and brings the person back to where they were. No popup,
  // and no page framing it is asked.
  it('unframed on its own label, signIn and connectApp go to the label\'s own /boogy/signin', async () => {
    const { Boogy } = await fresh(APP_ORIGIN_CONFIG);
    const assign = vi.fn();
    vi.stubGlobal('location', { origin: LABEL, pathname: '/rooms/7', search: '?tab=2', assign });
    const open = vi.spyOn(window, 'open');

    void new Boogy().connectApp('dave/chats');
    await vi.waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    const u = new URL(String(assign.mock.calls[0][0]), LABEL);
    expect(u.origin + u.pathname).toBe(`${LABEL}/boogy/signin`);
    expect(u.searchParams.get('aud')).toBeNull();
    expect(u.searchParams.get('redirect')).toBe('/rooms/7?tab=2');

    void new Boogy().signIn();
    await vi.waitFor(() => expect(assign).toHaveBeenCalledTimes(2));
    expect(String(assign.mock.calls[1][0])).toBe(String(assign.mock.calls[0][0]));
    expect(open).not.toHaveBeenCalled();
  });

  // The way back is a path on the label: a page whose own path starts with
  // `//` would otherwise name another host as the redirect.
  it('the way back names this label, whatever the page\'s own path looks like', async () => {
    const { Boogy } = await fresh(APP_ORIGIN_CONFIG);
    const assign = vi.fn();
    vi.stubGlobal('location', { origin: LABEL, pathname: '//evil.example', search: '?x=1', assign });
    void new Boogy().signIn();
    await vi.waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(new URL(String(assign.mock.calls[0][0]), LABEL).searchParams.get('redirect')).toBe('/evil.example?x=1');
  });

  it('unframed on its own label and signed in already, it goes nowhere', async () => {
    const { Boogy } = await fresh(APP_ORIGIN_CONFIG, SIGNED_IN);
    const assign = vi.fn();
    vi.stubGlobal('location', { origin: LABEL, pathname: '/', search: '', assign });
    await new Boogy().signIn();
    await new Boogy().connectApp('dave/chats');
    expect(assign).not.toHaveBeenCalled();
  });

  // A label serves its one service, so a sign-in there can only ever be for
  // that service: one named for another app is refused before anything starts.
  it('unframed on its own label, a sign-in for another app is refused and goes nowhere', async () => {
    const { Boogy } = await fresh(APP_ORIGIN_CONFIG);
    const assign = vi.fn();
    vi.stubGlobal('location', { origin: LABEL, pathname: '/', search: '', assign });
    await expect(new Boogy().connectApp('dave/notes')).rejects.toMatchObject({ code: 'app_not_found', app: 'dave/notes' });
    expect(assign).not.toHaveBeenCalled();
  });

  // An origin the platform names no service for has no sign-in of its own:
  // the platform's sign-in is the label's, a board's, or an app token's.
  it('unframed on an origin that names no service, connectApp refuses and goes nowhere', async () => {
    const { Boogy, BoogyError } = await fresh({ authOrigin: 'https://auth.boogy.app', owner: 'dave', shellOrigins: [SHELL] });
    const assign = vi.fn();
    vi.stubGlobal('location', { origin: 'https://example.com', pathname: '/', search: '', assign });
    const open = vi.spyOn(window, 'open');
    const err = await new Boogy().connectApp('dave/chats').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BoogyError);
    expect((err as InstanceType<typeof BoogyError>).code).toBe('sign_in_unavailable');
    expect(assign).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    // `signIn` has no one app to sign in to there, and still resolves.
    await expect(new Boogy().signIn()).resolves.toBeUndefined();
  });
});
