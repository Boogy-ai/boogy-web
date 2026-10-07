import { describe, it, expect } from 'vitest';
import { PANE_PROTOCOL, parseFrame } from './pane-protocol';

const good = {
  boogy: PANE_PROTOCOL,
  type: 'auth-state',
  nonce: 'n1',
  payload: { signedIn: true },
};

describe('parseFrame', () => {
  it('accepts a well-formed v1 frame', () => {
    expect(parseFrame(good)).toEqual(good);
  });

  it('rejects a future protocol version', () => {
    expect(parseFrame({ ...good, boogy: 'pane/v2' })).toBeNull();
  });

  it('rejects an unknown message type', () => {
    expect(parseFrame({ ...good, type: 'drop-tables' })).toBeNull();
  });

  // The one that matters: a guard checking only `type` is a string check
  // wearing validation's clothes.
  it('rejects a known type whose PAYLOAD is the wrong shape', () => {
    expect(parseFrame({ ...good, payload: { signedIn: 'yes' } })).toBeNull();
    expect(parseFrame({ ...good, type: 'title', payload: { text: 42 } })).toBeNull();
  });

  // A pane asks the page framing it to sign it in. It names nothing: the page
  // signs in the one app it framed there, so a payload that tries to name apps
  // is not a sign-in request.
  it('accepts sign-in only with an empty payload', () => {
    const s = { ...good, type: 'sign-in', payload: {} };
    expect(parseFrame(s)).toEqual(s);
    expect(parseFrame({ ...s, payload: { apps: ['tester/notes'] } })).toBeNull();
    expect(parseFrame({ ...s, payload: null })).toBeNull();
  });

  it('rejects non-objects and a missing nonce', () => {
    expect(parseFrame(null)).toBeNull();
    expect(parseFrame('nope')).toBeNull();
    const { nonce, ...noNonce } = good;
    void nonce;
    expect(parseFrame(noNonce)).toBeNull();
  });

  it('accepts hello, the pane announcing it is listening', () => {
    const f = { ...good, type: 'hello', payload: { service: 'notes' } };
    expect(parseFrame(f)).toEqual(f);
    expect(parseFrame({ ...f, payload: {} })).toBeNull();
  });

  it('accepts history (board to pane) only with a delta of -1 or 1', () => {
    const f = { ...good, type: 'history', payload: { delta: -1 } };
    expect(parseFrame(f)).toEqual(f);
    expect(parseFrame({ ...f, payload: { delta: 1 } })).not.toBeNull();
    expect(parseFrame({ ...f, payload: { delta: -3 } })).toBeNull();
    expect(parseFrame({ ...f, payload: { delta: '1' } })).toBeNull();
  });

  it('accepts history-state (pane to board) with two booleans', () => {
    const f = { ...good, type: 'history-state', payload: { canBack: true, canForward: false } };
    expect(parseFrame(f)).toEqual(f);
    expect(parseFrame({ ...f, payload: { canBack: 'yes', canForward: false } })).toBeNull();
  });

  // Where the app is shown: in a board. A page that does not say, or says
  // something this version does not know (a newer page may add one within
  // pane/v1), still connects the app — the app then does not know where it is
  // shown. So the connect is kept and the host is not. An app shown alone is
  // at its own address, unframed, so no page frames it alone any more:
  // `standalone` is no longer a host.
  it('connect keeps a host it knows, and drops one it does not without refusing the connect', () => {
    const c = (payload: unknown) => parseFrame({ boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n', payload });
    const host = (payload: unknown) => (c(payload)?.payload as { host?: unknown } | undefined)?.host;
    expect(host({ shellOrigin: 'https://b.example', host: 'board' })).toBe('board');
    for (const other of [undefined, 'standalone', 'console', true, 7, null]) {
      const f = c({ shellOrigin: 'https://b.example', host: other });
      expect(f, String(other)).not.toBeNull();
      expect('host' in f!.payload, String(other)).toBe(false);
    }
    expect(c({ host: 'board' })).toBeNull();
    expect(c({ shellOrigin: 7, host: 'board' })).toBeNull();
  });

  // How the last sign-in a page made for this app ended, when it did not sign
  // it in: the app words its prompt by it. Read like the host: kept when known.
  it('connect keeps a last sign-in it knows, and drops one it does not', () => {
    const last = (lastSignIn: unknown) =>
      (parseFrame({ boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n', payload: { shellOrigin: 'https://b.example', lastSignIn } })
        ?.payload as { lastSignIn?: unknown } | undefined)?.lastSignIn;
    expect(last('cancelled')).toBe('cancelled');
    expect(last('failed')).toBe('failed');
    for (const other of ['signed_in', true, 1, null]) expect(last(other), String(other)).toBeUndefined();
  });

  // The shell's answer to a pane's sign-in request.
  it('accepts sign-in-result with a known outcome, and a wait only for busy', () => {
    const r = (payload: unknown) => parseFrame({ boogy: PANE_PROTOCOL, type: 'sign-in-result', nonce: 'n', payload });
    for (const outcome of ['leaving', 'already_signed_in', 'unavailable']) {
      expect(r({ outcome }), outcome).not.toBeNull();
      expect(r({ outcome, retryAfterMs: 1000 }), outcome).toBeNull();
    }
    expect(r({ outcome: 'busy', retryAfterMs: 1500 })).not.toBeNull();
    for (const bad of [undefined, 0, -1, 1.5, Number.NaN, Infinity, 3_600_001, '1000']) {
      expect(r({ outcome: 'busy', retryAfterMs: bad }), String(bad)).toBeNull();
    }
    expect(r({ outcome: 'signed_in' })).toBeNull();
    expect(r({})).toBeNull();
  });

  // A history that is not one is dropped; the connect is not refused for it.
  it('connect may carry a history to hand back, bounded and consistent', () => {
    const c = { ...good, type: 'connect', payload: { shellOrigin: 'https://b.example', host: 'board', history: { entries: ['/a', '/a/1'], index: 1 } } };
    expect(parseFrame(c)).toEqual(c);
    expect(parseFrame({ ...c, payload: { shellOrigin: 'https://b.example', host: 'board' } })).not.toBeNull();
    for (const history of [{ entries: ['/a'], index: 1 }, { entries: [], index: 0 }, { entries: Array(51).fill('/a'), index: 0 }, 'x']) {
      const f = parseFrame({ ...c, payload: { ...c.payload, history } });
      expect(f, JSON.stringify(history)).toEqual({ ...c, payload: { shellOrigin: 'https://b.example', host: 'board' } });
    }
  });

  it('history-state may carry the whole history', () => {
    const h = { ...good, type: 'history-state', payload: { canBack: true, canForward: false, entries: ['/a', '/a/1'], index: 1 } };
    expect(parseFrame(h)).toEqual(h);
    expect(parseFrame({ ...h, payload: { ...h.payload, index: 2 } })).toBeNull();
  });
});

describe('parseFrame zoom', () => {
  it('accepts a zoom frame only with a finite factor in [0.5, 3]', () => {
    const z = (factor: unknown) => parseFrame({ boogy: PANE_PROTOCOL, type: 'zoom', nonce: 'n', payload: { factor } });
    for (const ok of [0.5, 1, 1.5, 3]) expect(z(ok), String(ok)).not.toBeNull();
    for (const bad of [Number.NaN, Infinity, -Infinity, 0.49, 3.01, '1.5', null, undefined]) {
      expect(z(bad), String(bad)).toBeNull();
    }
  });

  it("keeps a connect's zoom when valid, and drops one out of bounds without refusing the connect", () => {
    const zoom = (payload: object) =>
      (parseFrame({ boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n', payload: { host: 'board', ...payload } })
        ?.payload as { zoom?: unknown } | undefined)?.zoom;
    expect(zoom({ shellOrigin: 'https://b.example' })).toBeUndefined();
    expect(zoom({ shellOrigin: 'https://b.example', zoom: 1.25 })).toBe(1.25);
    for (const bad of [1000, 'big', Number.NaN]) {
      expect(parseFrame({ boogy: PANE_PROTOCOL, type: 'connect', nonce: 'n', payload: { shellOrigin: 'https://b.example', zoom: bad } }), String(bad)).not.toBeNull();
      expect(zoom({ shellOrigin: 'https://b.example', zoom: bad }), String(bad)).toBeUndefined();
    }
  });
});
