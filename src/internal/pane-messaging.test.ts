import { describe, it, expect, vi } from 'vitest';
import { PANE_PROTOCOL, type Frame } from './pane-protocol';
import { exactOrigin, sendFrame, receiveFrames } from './pane-messaging';

const frame = (nonce: string): Frame => ({
  boogy: PANE_PROTOCOL,
  type: 'auth-state',
  nonce,
  payload: { signedIn: true },
});

describe('exactOrigin', () => {
  it('accepts a real origin', () => {
    expect(exactOrigin('https://foo.example')).toBe('https://foo.example');
  });

  it('refuses the wildcard', () => {
    expect(() => exactOrigin('*')).toThrow(/wildcard/i);
  });

  it('refuses anything that is not an origin', () => {
    expect(() => exactOrigin('https://foo.example/path')).toThrow();
    expect(() => exactOrigin('foo.example')).toThrow();
  });
});

describe('sendFrame', () => {
  it('passes the exact origin through to postMessage', () => {
    const target = { postMessage: vi.fn() } as unknown as Window;
    sendFrame(target, exactOrigin('https://foo.example'), frame('n1'));
    expect(target.postMessage).toHaveBeenCalledWith(frame('n1'), 'https://foo.example');
  });

  it('cannot be called with a bare string origin', () => {
    const target = { postMessage: vi.fn() } as unknown as Window;
    // @ts-expect-error a bare string is not an ExactOrigin — this is the
    // type-level half of the no-wildcard rule, and the test fails to COMPILE
    // if the signature is ever widened.
    sendFrame(target, 'https://foo.example', frame('n1'));
  });
});

describe('receiveFrames', () => {
  function deliver(win: Window, init: Partial<MessageEventInit> & { data: unknown }) {
    win.dispatchEvent(new MessageEvent('message', { origin: 'https://foo.example', ...init }));
  }

  it('delivers a frame from an allowed source with the current nonce', () => {
    const onFrame = vi.fn();
    const source = {} as MessageEventSource;
    const off = receiveFrames(window, {
      nonce: 'n1',
      isAllowedSource: (s) => s === source,
      onFrame,
    });
    deliver(window, { data: frame('n1'), source });
    expect(onFrame).toHaveBeenCalledTimes(1);
    off();
  });

  // C4: all of one tenant's modules share an origin, so origin alone cannot
  // say WHICH pane spoke. This is the normal case, not an edge one.
  it('drops a frame from an unregistered source even when the origin is right', () => {
    const onFrame = vi.fn();
    const mine = {} as MessageEventSource;
    const theirs = {} as MessageEventSource;
    const off = receiveFrames(window, {
      nonce: 'n1',
      isAllowedSource: (s) => s === mine,
      onFrame,
    });
    deliver(window, { data: frame('n1'), source: theirs });
    expect(onFrame).not.toHaveBeenCalled();
    off();
  });

  it('drops a frame carrying a stale nonce', () => {
    const onFrame = vi.fn();
    const source = {} as MessageEventSource;
    const off = receiveFrames(window, { nonce: 'n2', isAllowedSource: () => true, onFrame });
    deliver(window, { data: frame('n1'), source });
    expect(onFrame).not.toHaveBeenCalled();
    off();
  });

  it('stops delivering after unsubscribe', () => {
    const onFrame = vi.fn();
    const off = receiveFrames(window, { nonce: 'n1', isAllowedSource: () => true, onFrame });
    off();
    deliver(window, { data: frame('n1'), source: {} as MessageEventSource });
    expect(onFrame).not.toHaveBeenCalled();
  });
});
