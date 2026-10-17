// useVendor: a script the host serves at /boogy/vendor/, once `wanted`. Until
// it loads, and while it will not, null; a failed load tries again, the wait
// doubling, a few times, while the component is shown.
import { useEffect, useState } from 'preact/hooks';

/** Tries in all, and the first wait, before a component settles for null. */
const LOAD_TRIES = 5;
const LOAD_RETRY_MS = 2000;

export function useVendor<T>(load: () => Promise<T>, loaded: () => T | null, wanted: boolean): T | null {
  const [value, setValue] = useState<T | null>(loaded);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (value || !wanted) return;
    let live = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    load().then(
      (v) => { if (live) setValue(() => v); },
      () => {
        if (live && attempt < LOAD_TRIES - 1) retry = setTimeout(() => setAttempt(attempt + 1), LOAD_RETRY_MS * 2 ** attempt);
      },
    );
    return () => { live = false; clearTimeout(retry); };
  }, [wanted, attempt]);
  return value;
}
