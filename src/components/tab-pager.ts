// TabPager: a row of pages, one shown at a time, turned by a sideways swipe —
// the body under a row of tabs, as a native tab pager is.
//
// THE SWIPE IS THE BROWSER'S OWN SCROLL: the pager scrolls sideways and snaps
// to a page, one page per fling. So the page follows the finger, flings and
// settles with the platform's own deceleration and edge bounce, and a swipe
// that starts inside a page's own content (a framed page, which no handler in
// this document would ever see) still turns it: what the content cannot scroll
// sideways passes out to the pager.
//
// A PAGE IS PLACED BY ITS INDEX, never by its place among its siblings, so
// pages can be reordered, added and removed without any element moving — and
// an element that moves loses what it holds (a framed page reloads, a video
// restarts).
//
// The page changes when the scroll SETTLES (`onIndexChange`), not mid-swipe; a
// row of tabs follows the swipe itself by watching the pager's scroll (TabList,
// when its `panel` names the pager).

/** The pager. */
export interface TabPagerAttrs {
  'data-boogy': 'tab-pager';
}

export function tabPager(): TabPagerAttrs {
  return { 'data-boogy': 'tab-pager' };
}

/** One page, at `index` in the row. */
export interface TabPageAttrs {
  'data-slot': 'page';
  role: 'tabpanel';
  style: { 'grid-column': string };
  /** A page that is not the current one is out of reach: no focus, no
   *  pointer, no screen reader, until it is turned to. */
  inert?: true;
}

export function tabPage(index: number, opts: { current?: boolean } = {}): TabPageAttrs {
  const attrs: TabPageAttrs = { 'data-slot': 'page', role: 'tabpanel', style: { 'grid-column': String(index + 1) } };
  if (opts.current === false) attrs.inert = true;
  return attrs;
}

/** Where a pager scrolled to `scrollLeft` is, in pages: 1.5 is halfway from
 *  the second page to the third. Right to left, `scrollLeft` runs negative. */
export function pagerPosition(scrollLeft: number, pageWidth: number): number {
  return pageWidth > 0 ? Math.abs(scrollLeft) / pageWidth : 0;
}

export interface TabPagerOptions {
  /** The current page. */
  index: number;
  /** A swipe settled on another page. */
  onIndexChange: (index: number) => void;
}

export interface TabPagerController {
  /** Turn to `index`: smoothly, or at once (and at once under reduced motion). */
  goTo(index: number, smooth: boolean): void;
  disconnect(): void;
}

/** How long a pager whose browser has no `scrollend` waits with no scroll
 *  before it counts the scroll as settled. */
const SETTLE_MS = 120;

/** Run a pager on `el` (`tabPager()`'s element, its children `tabPage()`s). */
export function connectTabPager(el: HTMLElement, opts: TabPagerOptions): TabPagerController {
  let current = opts.index;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const width = () => el.clientWidth;
  const sign = () => (getComputedStyle(el).direction === 'rtl' ? -1 : 1);
  const pages = () => Math.max(1, Math.round(el.scrollWidth / Math.max(1, width())));
  const align = () => {
    if (width() > 0) el.scrollLeft = sign() * current * width();
  };
  const settle = () => {
    clearTimeout(timer);
    const at = Math.min(pages() - 1, Math.max(0, Math.round(pagerPosition(el.scrollLeft, width()))));
    if (at === current) return;
    current = at;
    opts.onIndexChange(at);
  };
  const native = 'onscrollend' in el;
  const onScroll = () => {
    if (native) return;
    clearTimeout(timer);
    timer = setTimeout(settle, SETTLE_MS);
  };
  el.addEventListener('scroll', onScroll, { passive: true });
  if (native) el.addEventListener('scrollend', settle);
  // A new size (a rotation, a resized window) keeps the page it was on.
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(align);
  ro?.observe(el);
  align();
  return {
    goTo(index, smooth) {
      current = index;
      const left = sign() * index * width();
      if (Math.abs(el.scrollLeft - left) < 1) return;
      const still = !smooth || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (el.scrollTo) el.scrollTo({ left, behavior: still ? 'auto' : 'smooth' });
      else el.scrollLeft = left;
    },
    disconnect() {
      clearTimeout(timer);
      el.removeEventListener('scroll', onScroll);
      if (native) el.removeEventListener('scrollend', settle);
      ro?.disconnect();
    },
  };
}
