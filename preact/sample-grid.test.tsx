import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import 'preact/compat';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { SampleGrid } from './index';
import type { SampleGridProps } from './index';

afterEach(() => { document.body.replaceChildren(); });

// Ten samples in rows of four: 4, 4, 2.
const SAMPLES = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, label: `Sample ${i}`, style: { '--paint': `var(--p${i})` } }));

function mount(props: Partial<SampleGridProps> = {}) {
  const onValueChange = vi.fn();
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(
    <SampleGrid label="Pattern" samples={SAMPLES} value="s5" onValueChange={onValueChange} columns={4} {...props} />,
    root,
  ));
  const grid = root.querySelector<HTMLElement>('[data-boogy="sample-grid"]')!;
  const tiles = () => [...grid.querySelectorAll<HTMLButtonElement>(':scope > button[data-slot="sample"]')];
  return { root, grid, tiles, onValueChange };
}
const key = (el: Element, k: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  act(() => { el.dispatchEvent(e); });
  return e;
};

describe('<SampleGrid>', () => {
  it('is one named group of tiles, each named, painted as the app says, the chosen one pressed', () => {
    const { grid, tiles } = mount();
    expect(grid.getAttribute('role')).toBe('toolbar');
    expect(grid.getAttribute('aria-label')).toBe('Pattern');
    expect(tiles().map((t) => t.getAttribute('aria-label'))).toEqual(SAMPLES.map((s) => s.label));
    expect(tiles()[2].title).toBe('Sample 2');
    expect(tiles()[2].style.getPropertyValue('--paint')).toBe('var(--p2)');
    expect(tiles().map((t) => t.getAttribute('aria-pressed'))).toEqual(SAMPLES.map((s) => String(s.id === 's5')));
  });

  it('carries its columns and the rows it shows before it scrolls', () => {
    const { grid } = mount({ rows: 2.5 });
    expect(grid.style.getPropertyValue('--sample-grid-columns')).toBe('4');
    expect(grid.style.getPropertyValue('--sample-grid-rows')).toBe('2.5');
  });

  it('a press chooses a tile, once: the chosen one again chooses nothing', () => {
    const { tiles, onValueChange } = mount();
    act(() => tiles()[7].click());
    expect(onValueChange).toHaveBeenCalledWith('s7');
    act(() => tiles()[5].click());
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('is one tab stop, the chosen tile (else the first)', () => {
    expect(mount().tiles().map((t) => t.tabIndex).filter((t) => t === 0)).toHaveLength(1);
    expect(mount().tiles()[5].tabIndex).toBe(0);
    document.body.replaceChildren();
    expect(mount({ value: 'none' }).tiles()[0].tabIndex).toBe(0);
  });

  it('arrow keys move focus in the grid, Enter chooses', () => {
    const { tiles, onValueChange } = mount();
    tiles()[5].focus();
    expect(key(tiles()[5], 'ArrowRight').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(tiles()[6]);
    key(tiles()[6], 'ArrowDown');
    expect(document.activeElement).toBe(tiles()[9]);
    key(tiles()[9], 'Enter');
    expect(onValueChange).toHaveBeenCalledWith('s9');
  });

  it('leaves a modified key alone', () => {
    const { tiles } = mount();
    tiles()[5].focus();
    expect(key(tiles()[5], 'ArrowRight', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(tiles()[5]);
  });
});

describe('<SampleGrid lazy>', () => {
  // A stand-in IntersectionObserver that a test can say an element came into view in.
  let observers: { cb: IntersectionObserverCallback; seen: Set<Element> }[] = [];
  const realIO = globalThis.IntersectionObserver;
  const show = (el: Element) => act(() => {
    for (const o of observers) if (o.seen.has(el)) o.cb([{ target: el, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
  beforeEach(() => {
    observers = [];
    (globalThis as { IntersectionObserver: unknown }).IntersectionObserver = class {
      seen = new Set<Element>();
      constructor(public cb: IntersectionObserverCallback) { observers.push(this); }
      observe(el: Element) { this.seen.add(el); }
      unobserve(el: Element) { this.seen.delete(el); }
      disconnect() {}
    };
  });
  afterEach(() => { (globalThis as { IntersectionObserver: unknown }).IntersectionObserver = realIO; });

  it('every tile is there, named and in the tab order, but painted only once it comes near the view', () => {
    const { tiles } = mount({ lazy: true });
    expect(tiles()).toHaveLength(10);
    expect(tiles().map((t) => t.getAttribute('aria-label'))).toEqual(SAMPLES.map((s) => s.label));
    expect(tiles()[2].style.getPropertyValue('--paint')).toBe('');
    expect(tiles()[2].hasAttribute('data-pending')).toBe(true);
    show(tiles()[2]);
    expect(tiles()[2].style.getPropertyValue('--paint')).toBe('var(--p2)');
    expect(tiles()[2].hasAttribute('data-pending')).toBe(false);
  });

  it('the chosen tile is painted from the start', () => {
    const { tiles } = mount({ lazy: true });
    expect(tiles()[5].style.getPropertyValue('--paint')).toBe('var(--p5)');
  });

  it('a tile focused by the keyboard before it was seen is painted', () => {
    const { tiles } = mount({ lazy: true, value: 's0' });
    act(() => tiles()[0].focus());
    key(tiles()[0], 'End');
    expect(document.activeElement).toBe(tiles()[9]);
    expect(tiles()[9].style.getPropertyValue('--paint')).toBe('var(--p9)');
  });

  it('not lazy: every tile painted at once, as before', () => {
    const { tiles } = mount();
    expect(tiles().every((t, i) => t.style.getPropertyValue('--paint') === `var(--p${i})`)).toBe(true);
  });
});

describe('<SampleGrid rows="all">', () => {
  it('shows every row: no row count, marked to grow with its content', () => {
    const { grid } = mount({ rows: 'all' });
    expect(grid.getAttribute('data-rows')).toBe('all');
    expect(grid.style.getPropertyValue('--sample-grid-rows')).toBe('');
  });
});
