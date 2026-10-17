// Two ways to call less often, for live pages: coalesce a burst of signals
// into one re-read, and throttle a signal sent while something keeps changing
// (someone typing).

export interface Coalesced {
  (): void;
  /** Drop a wait in progress. */
  cancel(): void;
}

/** Calls in one burst become one call. The first starts a wait of a random
 *  length up to `jitterMs`, so many pages hearing the same signal do not all
 *  call at once; calls during the wait join it; `fn` runs once at its end. */
export function coalesce(fn: () => void, { jitterMs, random = Math.random }: { jitterMs: number; random?: () => number }): Coalesced {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const c = (() => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, Math.floor(Math.max(0, Math.min(1, random())) * jitterMs));
  }) as Coalesced;
  c.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return c;
}

/** At most one call per `intervalMs`: the first runs at once, calls within the
 *  interval are dropped, and nothing runs after the calls stop (no trailing
 *  call: a "still typing" signal must not arrive after the typing ended). */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, intervalMs: number, now: () => number = () => Date.now()): (...args: A) => void {
  let last = -Infinity;
  return (...args: A) => {
    const t = now();
    if (t - last < intervalMs) return;
    last = t;
    fn(...args);
  };
}
