import { BoogyError } from '../errors';

/** What a popup's message decides: settle with a value, fail, or (null) keep waiting. */
export type PopupDecision<T> = { value: T } | { error: BoogyError } | null;

export interface PopupParams<T> {
  url: string;
  /** The window name, so a second request reuses the same popup. */
  name: string;
  /** The only origin whose messages are read. Every other message is ignored. */
  origin: string;
  blocked(): BoogyError;
  /** The popup closed before a deciding message. */
  aborted(): BoogyError;
  decide(data: unknown): PopupDecision<T>;
  /** Stops waiting: rejects with `aborted()` and stops reading messages. */
  signal?: AbortSignal;
}

/**
 * Open a popup and settle on the first message from `origin` that `decide`
 * accepts, or reject when the popup is blocked or closed first.
 */
export function awaitPopup<T>(p: PopupParams<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const popup = window.open(p.url, p.name, 'popup,width=480,height=640');

    if (!popup) {
      reject(p.blocked());
      return;
    }

    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(closedPoll);
      // Superseded: the next call has taken over this window, so leave it open.
      if (p.signal?.aborted) return;
      // Best-effort: close the popup if it is still open.
      try {
        if (!popup.closed) popup.close();
      } catch {
        // Swallow cross-origin close errors (popup may already be gone).
      }
    };

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const onMessage = (event: MessageEvent) => {
      // Strictly check the origin — ignore any message not from the expected one.
      if (event.origin !== p.origin) return;
      const d = p.decide(event.data);
      if (!d) return;
      if ('error' in d) settle(() => reject(d.error));
      else settle(() => resolve(d.value));
    };

    window.addEventListener('message', onMessage);
    p.signal?.addEventListener('abort', () => settle(() => reject(p.aborted())), { once: true });

    // Poll for popup closure: closed before a deciding message means abandoned.
    const closedPoll = setInterval(() => {
      if (popup.closed) settle(() => reject(p.aborted()));
    }, 300);
  });
}
