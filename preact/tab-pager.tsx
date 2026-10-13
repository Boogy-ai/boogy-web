import type { ComponentChildren, JSX, RefObject } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { connectTabPager, tabPager, type TabPagerController, type TabPagerOptions } from '@boogy/web';

/** Run a pager on an element the app already renders (its children placed by
 *  `tabPage()`). `enabled: false` leaves the element alone, so one element can
 *  be a pager only some of the time without being replaced, and whatever its
 *  pages hold is never reloaded by the switch. */
export function useTabPager(ref: RefObject<HTMLElement>, { index, onIndexChange, enabled = true }: TabPagerOptions & { enabled?: boolean }): void {
  const latest = useRef(onIndexChange);
  latest.current = onIndexChange;
  const pager = useRef<TabPagerController | null>(null);
  const at = useRef(index);
  at.current = index;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const c = connectTabPager(el, { index: at.current, onIndexChange: (i) => latest.current(i) });
    pager.current = c;
    return () => { c.disconnect(); pager.current = null; };
  }, [enabled, ref]);
  // A new index from outside (a tab pressed) turns to it smoothly; one that
  // came from a settled swipe is already in place.
  useEffect(() => { pager.current?.goTo(index, true); }, [index]);
}

export type TabPagerProps = {
  /** Its id: the one its row of tabs names as `panel`. */
  id: string;
  /** The current page. */
  index: number;
  /** A swipe settled on another page. */
  onIndexChange: (index: number) => void;
  /** The pages, each placed with `tabPage(index, { current })`. */
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'id'>;

/** A row of pages, one shown at a time, turned by a sideways swipe. See
 *  `connectTabPager()`. */
export function TabPager({ id, index, onIndexChange, children, ...rest }: TabPagerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useTabPager(ref, { index, onIndexChange });
  return <div {...rest} {...tabPager()} id={id} ref={ref}>{children}</div>;
}
