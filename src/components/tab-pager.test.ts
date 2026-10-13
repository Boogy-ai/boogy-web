import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// From the package entry point: an export only the module itself can see is
// a defect these tests should catch.
import * as entry from '../index';
import { connectTabPager, pagerPosition, tabPage, tabPager } from '../index';

describe('tabPager', () => {
  it('is exported from the package entry point', () => {
    for (const name of ['tabPager', 'tabPage', 'pagerPosition', 'connectTabPager']) {
      expect(typeof (entry as Record<string, unknown>)[name], name).toBe('function');
    }
  });

  it('marks the pager', () => {
    expect(tabPager()).toEqual({ 'data-boogy': 'tab-pager' });
  });

  it('places a page by its index, never by its place among its siblings', () => {
    expect(tabPage(0)).toEqual({ 'data-slot': 'page', role: 'tabpanel', style: { 'grid-column': '1' } });
    expect(tabPage(3, { current: true })).toEqual({ 'data-slot': 'page', role: 'tabpanel', style: { 'grid-column': '4' } });
  });

  it('a page that is not the current one is out of reach (inert)', () => {
    expect(tabPage(1, { current: false })).toEqual({ 'data-slot': 'page', role: 'tabpanel', style: { 'grid-column': '2' }, inert: true });
  });
});

describe('pagerPosition', () => {
  it('is how far the pager has scrolled, in pages: halfway from the second page to the third is 1.5', () => {
    expect(pagerPosition(0, 300)).toBe(0);
    expect(pagerPosition(300, 300)).toBe(1);
    expect(pagerPosition(450, 300)).toBe(1.5);
  });

  it('reads the same right to left, where the scroll runs negative', () => {
    expect(pagerPosition(-450, 300)).toBe(1.5);
  });

  it('a pager with no width yet is on its first page', () => {
    expect(pagerPosition(120, 0)).toBe(0);
  });
});

// happy-dom lays nothing out: a pager's size is set here as a layout engine
// would report it, and its ResizeObserver fires when the test says so.
let resized: (() => void)[] = [];
class FakeResizeObserver {
  constructor(private cb: () => void) {}
  observe() { resized.push(this.cb); }
  unobserve() {}
  disconnect() { resized = resized.filter((cb) => cb !== this.cb); }
}

function pagerElement({ width = 300, pages = 4, rtl = false, scrollend = false } = {}) {
  const el = document.createElement('div');
  if (rtl) el.style.direction = 'rtl';
  document.body.append(el);
  let w = width;
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => w });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => w * pages });
  // A browser with `scrollend` (happy-dom has none).
  if (scrollend) (el as unknown as { onscrollend: null }).onscrollend = null;
  const scrollTo = vi.fn();
  el.scrollTo = scrollTo as unknown as typeof el.scrollTo;
  return {
    el,
    scrollTo,
    resize(n: number) { w = n; for (const cb of resized) cb(); },
    /** The browser scrolling it to `left`. */
    scroll(left: number) { el.scrollLeft = left; el.dispatchEvent(new Event('scroll')); },
    scrollEnd() { el.dispatchEvent(new Event('scrollend')); },
  };
}

describe('connectTabPager', () => {
  beforeEach(() => {
    resized = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('starts on its page, scrolled to it at once', () => {
    const p = pagerElement();
    connectTabPager(p.el, { index: 2, onIndexChange: vi.fn() });
    expect(p.el.scrollLeft).toBe(600);
  });

  it('right to left, its pages run the other way', () => {
    const p = pagerElement({ rtl: true });
    const onIndexChange = vi.fn();
    connectTabPager(p.el, { index: 2, onIndexChange });
    expect(p.el.scrollLeft).toBe(-600);
    vi.useFakeTimers();
    p.scroll(-300);
    vi.advanceTimersByTime(120);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
  });

  it('where the browser says when a scroll ends, a swipe that ends on another page reports it once, however often the end is said', () => {
    const p = pagerElement({ scrollend: true });
    const onIndexChange = vi.fn();
    connectTabPager(p.el, { index: 0, onIndexChange });
    p.scroll(150);
    expect(onIndexChange).not.toHaveBeenCalled();
    p.scroll(300);
    p.scrollEnd();
    p.scrollEnd();
    expect(onIndexChange.mock.calls).toEqual([[1]]);
  });

  it('where it does not, a scroll ends at a pause, reported once however many scroll events led up to it', () => {
    vi.useFakeTimers();
    const p = pagerElement();
    const onIndexChange = vi.fn();
    connectTabPager(p.el, { index: 0, onIndexChange });
    p.scroll(150);
    vi.advanceTimersByTime(100);
    p.scroll(290);
    vi.advanceTimersByTime(100);
    p.scroll(300);
    vi.advanceTimersByTime(119);
    expect(onIndexChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
    // Another pause on the same page is not another change.
    p.scroll(300);
    vi.advanceTimersByTime(120);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
  });

  it('a swipe that settles back on the page it started from reports nothing', () => {
    vi.useFakeTimers();
    const p = pagerElement();
    const onIndexChange = vi.fn();
    connectTabPager(p.el, { index: 1, onIndexChange });
    p.scroll(380);
    vi.advanceTimersByTime(50);
    p.scroll(300);
    vi.advanceTimersByTime(120);
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('settles on the nearest page, never past the last', () => {
    vi.useFakeTimers();
    const p = pagerElement({ pages: 4 });
    const onIndexChange = vi.fn();
    connectTabPager(p.el, { index: 0, onIndexChange });
    p.scroll(1000);
    vi.advanceTimersByTime(120);
    p.scroll(2000);
    vi.advanceTimersByTime(120);
    expect(onIndexChange.mock.calls).toEqual([[3]]);
  });

  describe('goTo', () => {
    beforeEach(() => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
    });

    it('turns to a page smoothly, or at once when asked', () => {
      const p = pagerElement();
      const c = connectTabPager(p.el, { index: 0, onIndexChange: vi.fn() });
      c.goTo(2, true);
      expect(p.scrollTo).toHaveBeenLastCalledWith({ left: 600, behavior: 'smooth' });
      c.goTo(3, false);
      expect(p.scrollTo).toHaveBeenLastCalledWith({ left: 900, behavior: 'auto' });
    });

    it('turns at once under reduced motion, even when asked to be smooth', () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('prefers-reduced-motion'), media: q, addEventListener() {}, removeEventListener() {} }));
      const p = pagerElement();
      const c = connectTabPager(p.el, { index: 0, onIndexChange: vi.fn() });
      c.goTo(1, true);
      expect(p.scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: 'auto' });
    });

    it('does not scroll a pager already in place', () => {
      const p = pagerElement();
      const c = connectTabPager(p.el, { index: 2, onIndexChange: vi.fn() });
      c.goTo(2, true);
      expect(p.scrollTo).not.toHaveBeenCalled();
    });

    it('right to left, turns the other way', () => {
      const p = pagerElement({ rtl: true });
      const c = connectTabPager(p.el, { index: 0, onIndexChange: vi.fn() });
      c.goTo(2, true);
      expect(p.scrollTo).toHaveBeenLastCalledWith({ left: -600, behavior: 'smooth' });
    });

    it('the page it turns to is current at once: the scroll it starts settles without reporting it back', () => {
      const p = pagerElement({ scrollend: true });
      const onIndexChange = vi.fn();
      const c = connectTabPager(p.el, { index: 0, onIndexChange });
      c.goTo(2, true);
      p.scroll(600);
      p.scrollEnd();
      expect(onIndexChange).not.toHaveBeenCalled();
    });
  });

  it('a new size (a rotation, a resized window) keeps the page it was on', () => {
    vi.useFakeTimers();
    const p = pagerElement();
    connectTabPager(p.el, { index: 1, onIndexChange: vi.fn() });
    expect(p.el.scrollLeft).toBe(300);
    p.resize(400);
    expect(p.el.scrollLeft).toBe(400);
    // ...including a page a swipe settled on.
    p.scroll(800);
    vi.advanceTimersByTime(120);
    p.resize(500);
    expect(p.el.scrollLeft).toBe(1000);
  });

  it('once disconnected it reports nothing and follows no resize', () => {
    vi.useFakeTimers();
    const p = pagerElement();
    const onIndexChange = vi.fn();
    connectTabPager(p.el, { index: 0, onIndexChange }).disconnect();
    p.scroll(300);
    vi.advanceTimersByTime(120);
    expect(onIndexChange).not.toHaveBeenCalled();
    expect(resized).toEqual([]);
  });
});
