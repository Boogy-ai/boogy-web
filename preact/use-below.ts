// Whether the window is narrower than one of the SDK's breakpoints, kept up to
// date as it is resized. `false` never is.
import { useEffect, useState } from 'preact/hooks';
import { DRAWER_BREAKPOINTS, type DrawerBreakpoint } from '@boogy/web';

export function useBelow(below: DrawerBreakpoint | false): boolean {
  const query = below ? `(width < ${DRAWER_BREAKPOINTS[below]})` : null;
  const read = () => Boolean(query && typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  const [is, setIs] = useState(read);
  useEffect(() => {
    if (!query || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const on = () => setIs(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return is;
}
