import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { useRef } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { tabPage } from '@boogy/web';
import * as entry from './index';
import { TabPager, useTabPager } from './index';

// happy-dom lays nothing out and has no `scrollend`: a pager's size is set
// here as a layout engine would report it, and a scroll settles at a pause.
const size = (el: HTMLElement, width: number, pages: number) => {
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => width });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => width * pages });
};
/** A swipe that comes to rest at `left`. */
const swipeTo = (el: HTMLElement, left: number) => {
  el.scrollLeft = left;
  el.dispatchEvent(new Event('scroll'));
  act(() => { vi.advanceTimersByTime(120); });
};

let root: HTMLElement;
beforeEach(() => {
  vi.useFakeTimers();
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  act(() => render(null, root));
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('<TabPager>', () => {
  it('is exported from the Preact entry point, with its hook', () => {
    expect(typeof entry.TabPager).toBe('function');
    expect(typeof entry.useTabPager).toBe('function');
  });

  it('is the pager, under the id its row of tabs names, holding the pages', () => {
    act(() => render(
      <TabPager id="pages" index={0} onIndexChange={() => {}}>
        {['a', 'b'].map((t, i) => <div key={t} {...tabPage(i, { current: i === 0 })}>{t}</div>)}
      </TabPager>, root));
    const pager = root.querySelector<HTMLElement>('#pages')!;
    expect(pager.dataset.boogy).toBe('tab-pager');
    expect([...pager.children].map((p) => p.getAttribute('data-slot'))).toEqual(['page', 'page']);
  });

  it('reports the page a swipe settles on, and turns smoothly to a page chosen from outside', () => {
    const onIndexChange = vi.fn();
    const draw = (index: number) => act(() => render(<TabPager id="pages" index={index} onIndexChange={onIndexChange} />, root));
    draw(0);
    const pager = root.querySelector<HTMLElement>('#pages')!;
    size(pager, 300, 4);
    swipeTo(pager, 300);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
    const scrollTo = vi.fn();
    pager.scrollTo = scrollTo as unknown as typeof pager.scrollTo;
    draw(3);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 900, behavior: 'smooth' });
  });
});

describe('useTabPager', () => {
  function Pages({ index, enabled, onIndexChange }: { index: number; enabled: boolean; onIndexChange: (i: number) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useTabPager(ref, { index, onIndexChange, enabled });
    return <div id="pages" ref={ref} />;
  }

  it('enabled: false leaves the element alone; turned on, it runs the pager on that same element, and off again stops', () => {
    const onIndexChange = vi.fn();
    const draw = (enabled: boolean) => act(() => render(<Pages index={2} enabled={enabled} onIndexChange={onIndexChange} />, root));
    draw(false);
    const el = root.querySelector<HTMLElement>('#pages')!;
    size(el, 300, 4);
    // Off: not placed on its page, and a swipe reports nothing.
    draw(false);
    expect(el.scrollLeft).toBe(0);
    swipeTo(el, 300);
    expect(onIndexChange).not.toHaveBeenCalled();
    // On: the same element, now placed on its page and reporting.
    draw(true);
    expect(root.querySelector('#pages')).toBe(el);
    expect(el.scrollLeft).toBe(600);
    swipeTo(el, 300);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
    // Off again.
    draw(false);
    swipeTo(el, 900);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
  });
});
