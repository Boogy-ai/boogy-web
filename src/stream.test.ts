import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openStream, parseEnvelope, type StreamSocket, type StreamTicket } from './stream';

/** A socket.io-like socket the test drives: it records emits, and fires events. */
function fakeIo() {
  const handlers = new Map<string, ((...a: any[]) => void)[]>();
  const emits: { event: string; payload: any; ack?: (r: any) => void }[] = [];
  let disconnected = false;
  let connects = 0;
  const socket: StreamSocket = {
    on: (e, fn) => { handlers.set(e, [...(handlers.get(e) ?? []), fn]); return socket; },
    emit: (event, payload, ack) => { emits.push({ event, payload, ack }); return socket; },
    connect: () => { connects++; return socket; },
    disconnect: () => { disconnected = true; return socket; },
  };
  const fire = (e: string, ...a: any[]) => (handlers.get(e) ?? []).forEach((fn) => fn(...a));
  const io = vi.fn((_url: string, _opts: { path: string; transports: string[] }) => socket);
  return { io, fire, emits, isDisconnected: () => disconnected, connects: () => connects };
}
const ticket = (n = 1): StreamTicket => ({ grant: `g${n}`, ttl_secs: 100, owner: 'tester', service: 'squad', channel: 'live' });
const env = (type: string, data: unknown = {}) => JSON.stringify({ type, v: 1, ts: 5, data });
/** Let pending promise callbacks run (timers are faked, so no setTimeout here). */
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => vi.useRealTimers());

describe('openStream', () => {
  it('connects to the gateway over websockets only, and subscribes with the minted ticket', async () => {
    const f = fakeIo();
    openStream({ io: f.io, mint: async () => ticket(), onEvent: () => {}, origin: 'https://tester.example' });
    // The gateway serves only the websocket transport: a client that starts
    // with HTTP long-polling is refused and never connects.
    expect(f.io).toHaveBeenCalledWith('https://tester.example', { path: '/v1/stream', transports: ['websocket'] });
    f.fire('connect');
    await flush();
    expect(f.emits).toHaveLength(1);
    expect(f.emits[0].event).toBe('subscribe');
    expect(f.emits[0].payload).toEqual({ kind: 'service', owner: 'tester', service_id: 'squad', channel: 'live', grant: 'g1' });
  });

  it('reports live once the subscribe is acknowledged, and offline on disconnect', async () => {
    const f = fakeIo();
    const statuses: string[] = [];
    openStream({ io: f.io, mint: async () => ticket(), onEvent: () => {}, onStatus: (s) => statuses.push(s), origin: 'x' });
    f.fire('connect');
    await flush();
    f.emits[0].ack!({ ok: true });
    f.fire('disconnect');
    expect(statuses).toEqual(['connecting', 'live', 'offline']);
  });

  it('a refused subscribe is offline, not live', async () => {
    const f = fakeIo();
    const statuses: string[] = [];
    openStream({ io: f.io, mint: async () => ticket(), onEvent: () => {}, onStatus: (s) => statuses.push(s), origin: 'x' });
    f.fire('connect');
    await flush();
    f.emits[0].ack!({ ok: false, error: 'not found' });
    expect(statuses).toEqual(['connecting', 'offline']);
  });

  it('re-mints at 80% of the ttl and re-subscribes in place', async () => {
    const f = fakeIo();
    let n = 0;
    openStream({ io: f.io, mint: async () => ticket(++n), onEvent: () => {}, origin: 'x' });
    f.fire('connect');
    await flush();
    expect(f.emits).toHaveLength(1);
    vi.advanceTimersByTime(79_000);
    await flush();
    expect(f.emits).toHaveLength(1);
    vi.advanceTimersByTime(1_000);
    await flush();
    expect(f.emits).toHaveLength(2);
    expect(f.emits[1].payload.grant).toBe('g2');
    expect(f.emits.every((e) => e.event === 'subscribe')).toBe(true);
  });

  it('after a reconnect it re-mints, re-subscribes, and asks the app to re-read', async () => {
    const f = fakeIo();
    const onResync = vi.fn();
    let n = 0;
    openStream({ io: f.io, mint: async () => ticket(++n), onEvent: () => {}, onResync, origin: 'x' });
    f.fire('connect');
    await flush();
    expect(onResync).not.toHaveBeenCalled();
    f.fire('disconnect');
    f.fire('connect');
    await flush();
    expect(f.emits).toHaveLength(2);
    expect(f.emits[1].payload.grant).toBe('g2');
    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it('delivers each sequence once across the snapshot and live, and skips malformed payloads', () => {
    const f = fakeIo();
    const got: [string, number][] = [];
    openStream({ io: f.io, mint: async () => ticket(), onEvent: (e, seq) => got.push([e.type, seq]), origin: 'x' });
    f.fire('svc:snapshot', { channel: 'live', payloads: [env('a'), env('b'), 'not json'], seqs: [1, 2, 3] });
    f.fire('svc', { channel: 'live', payload: env('b'), seq: 2 });
    f.fire('svc', { channel: 'live', payload: env('c'), seq: 4 });
    f.fire('svc', { channel: 'live', payload: env('u'), seq: 0 });
    f.fire('svc', { channel: 'live', payload: env('u') });
    expect(got).toEqual([['a', 1], ['b', 2], ['c', 4], ['u', 0], ['u', 0]]);
  });

  it('says which events are replayed history and which are live', () => {
    const f = fakeIo();
    const got: [string, boolean][] = [];
    openStream({ io: f.io, mint: async () => ticket(), onEvent: (e, _seq, replayed) => got.push([e.type, replayed]), origin: 'x' });
    f.fire('svc:snapshot', { channel: 'live', payloads: [env('old')], seqs: [1] });
    f.fire('svc', { channel: 'live', payload: env('new'), seq: 2 });
    expect(got).toEqual([['old', true], ['new', false]]);
  });

  it('reconnects itself after the server drops the socket, which the client library will not', async () => {
    const f = fakeIo();
    openStream({ io: f.io, mint: async () => ticket(), onEvent: () => {}, origin: 'x' });
    f.fire('connect');
    await flush();
    // A transport loss: the client library reconnects on its own.
    f.fire('disconnect', 'transport close');
    vi.advanceTimersByTime(10_000);
    expect(f.connects()).toBe(0);
    // The server ended it (an eviction): nothing reconnects unless we do.
    f.fire('disconnect', 'io server disconnect');
    expect(f.connects()).toBe(0);
    vi.advanceTimersByTime(2_000);
    expect(f.connects()).toBe(1);
  });

  it('after a reconnect, a sequence number seen before it is delivered again', async () => {
    // A restarted platform numbers a channel from 1 again; the app re-reads on
    // resync, so nothing from before the reconnect is worth suppressing.
    const f = fakeIo();
    const got: number[] = [];
    openStream({ io: f.io, mint: async () => ticket(), onEvent: (_e, seq) => got.push(seq), origin: 'x' });
    f.fire('connect');
    await flush();
    f.fire('svc', { channel: 'live', payload: env('a'), seq: 5 });
    f.fire('disconnect', 'transport close');
    f.fire('connect');
    await flush();
    f.fire('svc', { channel: 'live', payload: env('b'), seq: 5 });
    expect(got).toEqual([5, 5]);
  });

  it('a ticket that is not one is a failed mint, retried later — never a tight loop', async () => {
    const f = fakeIo();
    const statuses: string[] = [];
    let calls = 0;
    const bad = [{ error: 'rate limited' }, { grant: 'g', ttl_secs: Number.NaN, owner: 'o', service: 's', channel: 'c' }, { grant: 'g', ttl_secs: 2, owner: 'o', service: 's', channel: 'c' }];
    openStream({
      io: f.io,
      mint: async () => (calls <= bad.length - 1 ? bad[calls++] : (calls++, ticket())) as StreamTicket,
      onEvent: () => {},
      onStatus: (s) => statuses.push(s),
      origin: 'x',
    });
    f.fire('connect');
    await flush();
    expect(f.emits).toHaveLength(0);
    expect(statuses).toContain('offline');
    vi.advanceTimersByTime(4_999);
    await flush();
    expect(calls).toBe(1);
    for (let i = 0; i < 3; i++) { vi.advanceTimersByTime(5_000); await flush(); }
    expect(f.emits).toHaveLength(1);
  });

  it('close() disconnects, stops re-minting, and delivers nothing more', async () => {
    const f = fakeIo();
    const onEvent = vi.fn();
    const mint = vi.fn(async () => ticket());
    const s = openStream({ io: f.io, mint, onEvent, origin: 'x' });
    f.fire('connect');
    await flush();
    s.close();
    expect(f.isDisconnected()).toBe(true);
    vi.advanceTimersByTime(200_000);
    await flush();
    expect(mint).toHaveBeenCalledTimes(1);
    f.fire('svc', { channel: 'live', payload: env('late'), seq: 9 });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('close() while the socket is still connecting lets it connect, then closes it, subscribing to nothing', async () => {
    // Closing a websocket that is still connecting is a console error in
    // some engines; one that has connected closes quietly.
    const f = fakeIo();
    const mint = vi.fn(async () => ticket());
    const s = openStream({ io: f.io, mint, onEvent: () => {}, origin: 'x' });
    s.close();
    expect(f.isDisconnected()).toBe(false);
    f.fire('connect');
    await flush();
    expect(f.isDisconnected()).toBe(true);
    expect(mint).not.toHaveBeenCalled();
    expect(f.emits).toHaveLength(0);
  });

  it('close() while connecting, then the connection fails: it closes there, so nothing retries', async () => {
    const f = fakeIo();
    const s = openStream({ io: f.io, mint: async () => ticket(), onEvent: () => {}, origin: 'x' });
    s.close();
    expect(f.isDisconnected()).toBe(false);
    f.fire('connect_error', new Error('refused'));
    expect(f.isDisconnected()).toBe(true);
  });

  it('close() after the server ended the connection, before it is back, closes once it reconnects', async () => {
    const f = fakeIo();
    const s = openStream({ io: f.io, mint: async () => ticket(), onEvent: () => {}, origin: 'x' });
    f.fire('connect');
    await flush();
    f.fire('disconnect', 'transport close');
    s.close();
    expect(f.isDisconnected()).toBe(false);
    f.fire('connect');
    expect(f.isDisconnected()).toBe(true);
  });

  it('a failed mint goes offline and retries', async () => {
    const f = fakeIo();
    let calls = 0;
    const statuses: string[] = [];
    openStream({
      io: f.io,
      mint: async () => { if (++calls === 1) throw new Error('no'); return ticket(); },
      onEvent: () => {},
      onStatus: (s) => statuses.push(s),
      origin: 'x',
    });
    f.fire('connect');
    await flush();
    expect(statuses).toContain('offline');
    expect(f.emits).toHaveLength(0);
    vi.advanceTimersByTime(5_000);
    await flush();
    expect(f.emits).toHaveLength(1);
  });
});

describe('parseEnvelope', () => {
  it('accepts a typed envelope and refuses anything else', () => {
    expect(parseEnvelope(env('x', { a: 1 }))).toEqual({ type: 'x', v: 1, ts: 5, data: { a: 1 } });
    for (const bad of ['', 'nope', '{"v":1}', '{"type":"x"}', 42, null, '{"type":3,"v":1,"data":{}}', '[1]']) {
      expect(parseEnvelope(bad), String(bad)).toBeNull();
    }
  });
});
