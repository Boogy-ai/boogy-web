// useDebounced: a value that follows another a moment after its last change,
// so a search box asks once per pause rather than once per key. The delay is
// the SDK's search delay unless the caller says.
import { useEffect, useState } from 'preact/hooks';
import { SEARCH_DELAY_MS } from '@boogy/web';

export function useDebounced<T>(value: T, ms: number = SEARCH_DELAY_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
