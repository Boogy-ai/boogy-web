import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest';
import { Boogy } from './boogy';
import { loadPlatformConfig } from './internal/platform-config';

beforeAll(async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ authOrigin: 'https://auth.boogy.ai', owner: 'alice', shellOrigins: [] }), { status: 200 }),
  );
  await loadPlatformConfig();
  vi.restoreAllMocks();
  vi.stubGlobal('location', { origin: 'https://alice.boogy.ai', pathname: '/', search: '' });
});
beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

const me = { pairwiseId: 'pw', services: ['boards'], displayName: 'Alice', avatarUrl: null };

describe('Boogy.currentUser', () => {
  it('returns the whole session the platform reports, name and covered services included', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(me), { status: 200 }));
    await expect(new Boogy().currentUser('alice/boards')).resolves.toEqual(me);
  });
});

describe('Boogy.renew', () => {
  it('does nothing for a tab that has never held a session', () => {
    const boogy = new Boogy();
    const connect = vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);
    expect(boogy.renew('alice/boards')).toBe(false);
    expect(connect).not.toHaveBeenCalled();
  });

  it('after currentUser saw a session, renews once — with renewAudiences — then waits out the cooldown', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(me), { status: 200 }));
    const boogy = new Boogy({ renewAudiences: () => ['alice/notes'] });
    const connect = vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);
    await boogy.currentUser('alice/boards');
    expect(boogy.renew('alice/boards')).toBe(true);
    expect(connect).toHaveBeenCalledWith(['alice/boards', 'alice/notes']);
    expect(boogy.renew('alice/boards')).toBe(false);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('a signed-out answer from currentUser does not arm it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('null', { status: 200 }));
    const boogy = new Boogy();
    vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);
    await boogy.currentUser('alice/boards');
    expect(boogy.renew('alice/boards')).toBe(false);
  });

  it('a failing renewal is reported, never thrown', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(me), { status: 200 }));
    const boogy = new Boogy();
    vi.spyOn(boogy, 'connectApp').mockRejectedValue(new Error('boom'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await boogy.currentUser('alice/boards');
    expect(boogy.renew('alice/boards')).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalled();
  });
});

describe('Boogy.signOut result', () => {
  it('resolves true only when the platform confirmed it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await expect(new Boogy().signOut('alice/boards')).resolves.toBe(true);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(new Boogy().signOut('alice/boards')).resolves.toBe(false);
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('offline'));
    await expect(new Boogy().signOut('alice/boards')).resolves.toBe(false);
  });

  it('after signing out, renew never fires', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(me), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const boogy = new Boogy();
    vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);
    await boogy.currentUser('alice/boards');
    await boogy.signOut('alice/boards');
    expect(boogy.renew('alice/boards')).toBe(false);
  });
});

describe('Boogy.refreshSession', () => {
  it('POSTs /boogy/renew on its own origin and reports success', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"services":["boards"]}', { status: 200 }));
    await expect(new Boogy().refreshSession('alice/boards')).resolves.toBe(true);
    expect(f).toHaveBeenCalledWith(
      'https://alice.boogy.ai/boogy/renew',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
  });

  it('is false on a 401, and a network failure is false rather than thrown', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(new Boogy().refreshSession('alice/boards')).resolves.toBe(false);
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('offline'));
    await expect(new Boogy().refreshSession('alice/boards')).resolves.toBe(false);
  });

  it('another owner\'s app is not this origin\'s to renew — false, no request, no throw', async () => {
    const f = vi.spyOn(globalThis, 'fetch');
    await expect(new Boogy().refreshSession('bob/notes')).resolves.toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('a successful refresh arms renewal, like any other seen session', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const boogy = new Boogy();
    const connect = vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);
    await boogy.refreshSession('alice/boards');
    expect(boogy.renew('alice/boards')).toBe(true);
    expect(connect).toHaveBeenCalledTimes(1);
  });
});

describe('Boogy.renew — framed', () => {
  // happy-dom's `window.top` is the window itself; a different object is what
  // a frame sees.
  beforeEach(() => vi.stubGlobal('top', {}));
  afterEach(() => vi.unstubAllGlobals());

  it('never navigates or opens a popup — the board signs a framed app in', async () => {
    vi.stubGlobal('location', { origin: 'https://alice.boogy.ai', pathname: '/', search: '' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(me), { status: 200 }));
    const boogy = new Boogy();
    const connect = vi.spyOn(boogy, 'connectApp').mockResolvedValue(undefined);
    await boogy.currentUser('alice/boards');
    expect(boogy.renew('alice/boards')).toBe(false);
    expect(connect).not.toHaveBeenCalled();
  });
});
