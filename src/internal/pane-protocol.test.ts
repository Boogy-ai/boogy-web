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

  // Sign-in is deferred out of v1; a frame naming it is not ours yet.
  it('does not accept sign-in, which v1 does not carry', () => {
    expect(parseFrame({ ...good, type: 'sign-in', payload: { apps: ['tester/notes'] } })).toBeNull();
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
});
