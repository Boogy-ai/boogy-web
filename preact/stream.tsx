// useStream: a live channel for the lifetime of a component. See openStream in
// the core package; this keeps one stream open while mounted and enabled,
// always calls the latest callbacks, and reports the connection status.
import { useEffect, useRef, useState } from 'preact/hooks';
import { openStream, type StreamOptions, type StreamStatus } from '@boogy/web';

export function useStream(opts: StreamOptions & { enabled?: boolean }): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const latest = useRef(opts);
  latest.current = opts;
  const enabled = opts.enabled !== false;
  useEffect(() => {
    if (!enabled) return;
    const stream = openStream({
      io: latest.current.io,
      origin: latest.current.origin,
      mint: () => latest.current.mint(),
      onEvent: (e, seq, replayed) => latest.current.onEvent(e, seq, replayed),
      onStatus: (s) => {
        setStatus(s);
        latest.current.onStatus?.(s);
      },
      onResync: () => latest.current.onResync?.(),
    });
    return () => stream.close();
  }, [enabled]);
  return status;
}
