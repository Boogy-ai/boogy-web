// A surface that fills the screen (a popover's page, a side panel on a phone)
// is a page to the person using it: the browser's Back, or a phone's back
// gesture, should take it away. While `active`, this pushes a history entry
// whose popping calls `close`; a surface closed any other way steps back over
// its entry, so no dead entry is left behind.
import { useLayoutEffect, useRef } from 'preact/hooks';

/** The step back a closed page asked for, until the browser has taken it: a
 *  page that opens meanwhile adds its own entry only after it, or that step
 *  would land on the new entry and close the new page. */
let stepping: Promise<void> | null = null;
function stepBack() {
  const step = new Promise<void>((resolve) => {
    const done = () => { window.removeEventListener('popstate', done); clearTimeout(timer); resolve(); };
    // No history to step through fires no popstate.
    const timer = window.setTimeout(done, 300);
    window.addEventListener('popstate', done);
  });
  stepping = step;
  void step.then(() => { if (stepping === step) stepping = null; });
  history.back();
}

/** The history state key an entry is marked with. Shared by every surface,
 *  so one opened as another closes waits for that one's step back. */
const KEY = 'boogyPopover';
const entryOf = () => (history.state as Record<string, string> | null)?.[KEY];

export function useBackCloses(active: boolean, close: () => void): void {
  const id = useRef(`p${Math.random().toString(36).slice(2)}`);
  const closeRef = useRef(close);
  closeRef.current = close;
  useLayoutEffect(() => {
    if (!active) return;
    let pushed = false;
    let live = true;
    const onPop = () => {
      if (!pushed || entryOf() === id.current) return;
      pushed = false;
      closeRef.current();
    };
    const push = () => {
      if (!live) return;
      history.pushState({ ...(history.state as object | null), [KEY]: id.current }, '');
      pushed = true;
      window.addEventListener('popstate', onPop);
    };
    if (stepping) void stepping.then(push);
    else push();
    return () => {
      live = false;
      window.removeEventListener('popstate', onPop);
      if (pushed && entryOf() === id.current) stepBack();
    };
  }, [active]);
}
