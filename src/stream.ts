// A live channel, from the browser: connect to the platform's streaming
// gateway, subscribe with a short-lived grant the app's own service mints,
// keep the grant fresh, survive reconnects, and hand the app each typed event
// once. The socket.io client is passed in, so this module carries no
// dependency of its own.
//
// The stream is a hint, not the record: after a reconnect, events may have been
// missed, so `onResync` asks the app to re-read its real state.

/** What the app's own service mints: the grant and where it subscribes. */
export interface StreamTicket {
  grant: string;
  ttl_secs: number;
  /** The service owner's handle. */
  owner: string;
  service: string;
  channel: string;
}

/** A typed event: `{ type, v, ts, data }`. */
export interface StreamEnvelope {
  type: string;
  v: number;
  ts: number;
  data: unknown;
}

export type StreamStatus = 'connecting' | 'live' | 'offline';

/** The part of a socket.io-client socket this needs. */
export interface StreamSocket {
  on(event: string, fn: (...args: any[]) => void): unknown;
  emit(event: string, payload: unknown, ack?: (res: { ok?: boolean; error?: string }) => void): unknown;
  connect(): unknown;
  disconnect(): unknown;
}

/** socket.io-client's `io`. */
export type StreamConnect = (url: string, opts: { path: string; transports: string[] }) => StreamSocket;

export interface StreamOptions {
  io: StreamConnect;
  /** Fetch a fresh ticket from the app's own service. */
  mint: () => Promise<StreamTicket>;
  /** One typed event, at most once per sequence number. `replayed` is true for
   *  the channel's recent history, sent once on subscribe — not something that
   *  just happened (a typing signal from then is long over, say). */
  onEvent: (envelope: StreamEnvelope, seq: number, replayed: boolean) => void;
  onStatus?: (status: StreamStatus) => void;
  /** After a reconnect: re-read real state, since events may have been missed. */
  onResync?: () => void;
  /** The gateway's origin; default this page's. */
  origin?: string;
}

/** A ticket is renewed at this share of its lifetime. */
export const REMINT_AT = 0.8;
/** After a failed mint, try again this many seconds later. */
const RETRY_SECS = 5;
/** After the server ends the connection, reconnect this many seconds later. */
const RECONNECT_SECS = 2;
/** The shortest grant lifetime the platform mints. */
const MIN_TTL_SECS = 10;

/** Whether a mint's answer is a usable ticket. An error body (a refusal, a
 *  rate limit) is not, and must never be renewed on its own schedule. */
function isTicket(t: unknown): t is StreamTicket {
  if (typeof t !== 'object' || t === null) return false;
  const x = t as Record<string, unknown>;
  return (
    typeof x.grant === 'string' && x.grant !== '' &&
    typeof x.ttl_secs === 'number' && Number.isFinite(x.ttl_secs) && x.ttl_secs >= MIN_TTL_SECS &&
    typeof x.owner === 'string' && typeof x.service === 'string' && typeof x.channel === 'string'
  );
}
/** How many sequence numbers are remembered for de-duplication. */
const SEEN_LIMIT = 1024;

/** A typed envelope from a published payload, or null for anything else. */
export function parseEnvelope(raw: unknown): StreamEnvelope | null {
  if (typeof raw !== 'string') return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const e = v as Record<string, unknown>;
  if (typeof e.type !== 'string' || typeof e.v !== 'number' || !('data' in e)) return null;
  return { type: e.type, v: e.v, ts: typeof e.ts === 'number' ? e.ts : 0, data: e.data };
}

export function openStream(opts: StreamOptions): { close(): void } {
  let closed = false;
  let connectedBefore = false;
  /** Whether the socket is connected now. */
  let connected = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const seen = new Set<number>();
  const order: number[] = [];

  // A sequence of 0 or none is unsequenced: always delivered, never deduped,
  // since two unsequenced events cannot be told apart.
  const fresh = (seq: number) => {
    if (!seq) return true;
    if (seen.has(seq)) return false;
    seen.add(seq);
    order.push(seq);
    if (order.length > SEEN_LIMIT) seen.delete(order.shift()!);
    return true;
  };
  const deliver = (raw: unknown, seq: number, replayed: boolean) => {
    if (closed || !fresh(seq)) return;
    const envelope = parseEnvelope(raw);
    if (envelope) opts.onEvent(envelope, seq, replayed);
  };
  const status = (s: StreamStatus) => {
    if (!closed) opts.onStatus?.(s);
  };
  const later = (secs: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => void subscribe(), secs * 1000);
  };

  // The gateway serves only the websocket transport; a client that starts with
  // HTTP long-polling is refused and never connects.
  const socket = opts.io(opts.origin ?? location.origin, { path: '/v1/stream', transports: ['websocket'] });
  status('connecting');

  // Subscribe — or re-subscribe in place — with a fresh ticket.
  async function subscribe(): Promise<void> {
    let t: unknown;
    try {
      t = await opts.mint();
    } catch {
      t = null;
    }
    if (!isTicket(t)) {
      status('offline');
      later(RETRY_SECS);
      return;
    }
    if (closed) return;
    socket.emit(
      'subscribe',
      { kind: 'service', owner: t.owner, service_id: t.service, channel: t.channel, grant: t.grant },
      (ack) => status(ack?.ok ? 'live' : 'offline'),
    );
    later(t.ttl_secs * REMINT_AT);
  }

  socket.on('connect', () => {
    connected = true;
    // Closed while it was still connecting: closed now that it is open.
    if (closed) {
      socket.disconnect();
      return;
    }
    const again = connectedBefore;
    connectedBefore = true;
    // A fresh connection: what was seen before it says nothing about what
    // comes now (a restarted platform numbers a channel from 1 again), and the
    // app re-reads on resync anyway.
    if (again) {
      seen.clear();
      order.length = 0;
    }
    void subscribe().then(() => {
      if (again && !closed) opts.onResync?.();
    });
  });
  // Closed while connecting, and this attempt failed: closing now stops the
  // client's retries.
  socket.on('connect_error', () => {
    if (closed) socket.disconnect();
  });
  socket.on('disconnect', (reason?: string) => {
    connected = false;
    status('offline');
    // The client library reconnects by itself after a lost transport, but not
    // when the server ended the connection (an eviction, say) — that one is ours.
    if (reason === 'io server disconnect' && !closed) {
      setTimeout(() => {
        if (!closed) socket.connect();
      }, RECONNECT_SECS * 1000);
    }
  });
  socket.on('svc:snapshot', (m: { payloads?: unknown[]; seqs?: number[] } | undefined) => {
    (m?.payloads ?? []).forEach((p, i) => deliver(p, m?.seqs?.[i] ?? 0, true));
  });
  socket.on('svc', (m: { payload?: unknown; seq?: number } | undefined) => deliver(m?.payload, m?.seq ?? 0, false));

  return {
    close() {
      closed = true;
      clearTimeout(timer);
      // A socket still connecting is closed once it connects, or once the
      // attempt fails: closing a websocket mid-handshake is a console error
      // in some engines, and the page did nothing wrong.
      if (connected) socket.disconnect();
    },
  };
}
