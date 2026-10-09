import { describe, it, expect, vi, afterEach, beforeEach, beforeAll } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { resetZoom, zoomState } from '@boogy/web';
import { flushRounds, setFrameScheduler } from '../src/components/measure';
import { Glyph, TopBar, type TopBarItem } from './index';

// happy-dom's ResizeObserver never fires: this one fires when the test says
// the layout changed, as a browser's would.
const observed = new Map<Element, (entries: { target: Element }[]) => void>();
class FakeResizeObserver {
  constructor(private cb: (entries: { target: Element }[]) => void) {}
  observe(el: Element) { observed.set(el, this.cb); }
  unobserve(el: Element) { observed.delete(el); }
  disconnect() {}
}
beforeAll(() => { vi.stubGlobal('ResizeObserver', FakeResizeObserver); });

let restore: (run: () => void) => void;
beforeEach(() => { restore = setFrameScheduler(() => {}); });
afterEach(() => {
  setFrameScheduler(restore);
  act(() => resetZoom());
  document.body.innerHTML = '';
});

function mount(node: preact.ComponentChild) {
  const root = document.createElement('div');
  document.body.append(root);
  act(() => render(node, root));
  return root;
}

// happy-dom lays nothing out: the bar's room and each item's width are set
// here, as a layout engine would report them, then the fit runs.
function layout(root: HTMLElement, barWidth: number, widths: Record<string, number>, more = 30, lead = 0) {
  const bar = root.querySelector<HTMLElement>('[data-boogy="top-bar"]')!;
  const leading = bar.querySelector<HTMLElement>('[data-slot="leading"]');
  if (leading) leading.getBoundingClientRect = () => ({ width: lead, height: 20, x: 0, y: 0, top: 0, left: 0, right: lead, bottom: 20, toJSON() {} }) as DOMRect;
  Object.defineProperty(bar, 'clientWidth', { configurable: true, get: () => barWidth });
  for (const el of bar.querySelectorAll<HTMLElement>('[data-slot="measure"] [data-item]')) {
    const w = el.dataset.item === '' ? more : widths[el.dataset.item!] ?? 0;
    el.getBoundingClientRect = () => ({ width: w, height: 20, x: 0, y: 0, top: 0, left: 0, right: w, bottom: 20, toJSON() {} }) as DOMRect;
  }
  act(() => {
    observed.get(bar)?.([{ target: bar }]);
    flushRounds();
  });
}
const barItems = (root: HTMLElement) => [...root.querySelectorAll('[data-boogy="top-bar"] > [data-slot="actions"] > [data-item]')].map((el) => (el as HTMLElement).dataset.item);
const more = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('[data-boogy="top-bar"] > [data-slot="actions"] [data-slot="more"]');
const menu = () => document.querySelector<HTMLElement>('[role="menu"]');

const ACTIONS: TopBarItem[] = [
  { id: 'edit', label: 'Edit', priority: 1, onAction: vi.fn() },
  { id: 'links', label: 'Invite links', priority: 1, onAction: vi.fn() },
  { id: 'present', label: 'Present', priority: 2, onAction: vi.fn() },
  { id: 'close', label: 'Close', priority: 3, variant: 'danger', onAction: vi.fn() },
  { id: 'delete', label: 'Delete', priority: 4, variant: 'danger', onAction: vi.fn() },
];
const WIDTHS = { edit: 50, links: 70, present: 60, close: 60, delete: 60 };

describe('<TopBar>', () => {
  it('has a title area: a leading control, the title as a heading, and a line under it', () => {
    const root = mount(<TopBar leading={<button>Home</button>} title="Dashboard" subtitle="12 polls" />);
    const bar = root.querySelector('[data-boogy="top-bar"]')!;
    expect(bar.querySelector('[data-slot="leading"] button')!.textContent).toBe('Home');
    expect(bar.querySelector('h1[data-slot="title"]')!.textContent).toBe('Dashboard');
    expect(bar.querySelector('[data-slot="subtitle"]')!.textContent).toBe('12 polls');
    const p = mount(<TopBar title="Quiet" titleAs="p" />);
    expect(p.querySelector('p[data-slot="title"]')).toBeTruthy();
  });

  it('keeps the most important actions as the bar narrows, the rest in More in priority order, and brings them back as it widens', () => {
    const root = mount(<TopBar title="T" items={ACTIONS} zoom={false} />);
    // The room left for actions is the bar less the title's minimum (0 here) and their gap (0 here).
    layout(root, 250, WIDTHS);
    expect(barItems(root)).toEqual(['edit', 'links', 'present']);
    expect(more(root)!.getAttribute('aria-haspopup')).toBe('menu');
    expect(more(root)!.getAttribute('aria-expanded')).toBe('false');
    act(() => more(root)!.click());
    expect([...menu()!.querySelectorAll('[role="menuitem"]')].map((m) => m.textContent)).toEqual(['Close', 'Delete']);
    act(() => more(root)!.click());
    layout(root, 1000, WIDTHS);
    expect(barItems(root)).toEqual(['edit', 'links', 'present', 'close', 'delete']);
    expect(more(root)).toBeNull();
  });

  it('a bar not laid out yet (no width: hidden, or no layout at all) keeps every item where it is', () => {
    const root = mount(<TopBar title="T" items={ACTIONS} />);
    layout(root, 0, WIDTHS);
    expect(barItems(root)).toEqual(['edit', 'links', 'present', 'close', 'delete']);
    layout(root, 100, WIDTHS);
    expect(barItems(root)).toEqual(['edit']);
    layout(root, 0, WIDTHS);
    expect(barItems(root)).toEqual(['edit']);
  });

  it('the size control is built in: in the menu by default, as a labelled row, and More shows for it alone', () => {
    const root = mount(<TopBar title="T" />);
    layout(root, 1000, {});
    expect(barItems(root)).toEqual([]);
    act(() => more(root)!.click());
    const row = menu()!.querySelector('[role="group"]')!;
    expect(row.getAttribute('aria-label')).toBe('Text size');
    expect([...row.querySelectorAll('button')].map((b) => [b.getAttribute('role'), b.getAttribute('aria-label')])).toEqual([['menuitem', 'Smaller'], ['menuitem', 'Larger']]);
  });

  it("zoom='bar' keeps the size control in the bar, with no More for it; zoom={false} leaves it out", () => {
    const root = mount(<TopBar title="T" zoom="bar" />);
    layout(root, 1000, { zoom: 60 });
    expect(barItems(root)).toEqual(['zoom']);
    expect(more(root)).toBeNull();
    const none = mount(<TopBar title="T" zoom={false} />);
    layout(none, 1000, {});
    expect(more(none)).toBeNull();
    expect(none.querySelector('[data-slot="zoom"], [aria-label="Larger"]')).toBeNull();
  });

  it("a widget the caller keeps in the bar stays there", () => {
    const root = mount(<TopBar title="T" zoom={false} items={[{ id: 'w', label: 'Widget', priority: 9, place: 'bar', widget: <button>w</button> }]} />);
    layout(root, 1000, { w: 60 });
    expect(barItems(root)).toEqual(['w']);
    expect(more(root)).toBeNull();
  });

  it('More is the SDK glyph, sized from the icon tokens', () => {
    const root = mount(<TopBar title="T" />);
    layout(root, 1000, {});
    expect(more(root)!.querySelector('svg[data-boogy="glyph"]')).toBeTruthy();
  });

  it('when the menu empties it closes, and does not open again by itself when items return', () => {
    const root = mount(<TopBar title="T" items={ACTIONS} zoom={false} />);
    layout(root, 100, WIDTHS);
    act(() => more(root)!.click());
    expect(menu()).toBeTruthy();
    layout(root, 1000, WIDTHS);
    expect(more(root)).toBeNull();
    expect(menu()).toBeNull();
    layout(root, 100, WIDTHS);
    expect(more(root)!.getAttribute('aria-expanded')).toBe('false');
    expect(menu()).toBeNull();
  });

  it('ArrowDown on More opens the menu on its first row, ArrowUp on its last', () => {
    const root = mount(<TopBar title="T" items={ACTIONS} zoom={false} />);
    layout(root, 100, WIDTHS);
    act(() => { more(root)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); });
    expect(document.activeElement!.textContent).toBe('Invite links');
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    act(() => { more(root)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })); });
    expect(document.activeElement!.textContent).toBe('Delete');
  });

  it('a leading control that comes later is watched, and the fit runs again when it does', () => {
    const root = document.createElement('div');
    document.body.append(root);
    act(() => render(<TopBar title="T" items={ACTIONS} zoom={false} />, root));
    layout(root, 250, WIDTHS);
    expect(barItems(root)).toEqual(['edit', 'links', 'present']);
    act(() => render(<TopBar title="T" leading={<button>Back</button>} items={ACTIONS} zoom={false} />, root));
    const leading = root.querySelector('[data-slot="leading"]')!;
    expect(observed.has(leading)).toBe(true);
    leading.getBoundingClientRect = () => ({ width: 100, height: 20, x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 20, toJSON() {} }) as DOMRect;
    act(() => {
      observed.get(leading)!([{ target: leading }]);
      flushRounds();
    });
    expect(barItems(root)).toEqual(['edit', 'links']);
  });

  it('a menu item runs its action and closes the menu; Escape closes it and gives focus back to More', () => {
    const root = mount(<TopBar title="T" items={ACTIONS} zoom={false} />);
    layout(root, 100, WIDTHS);
    act(() => more(root)!.click());
    expect(more(root)!.getAttribute('aria-expanded')).toBe('true');
    const items = [...menu()!.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(items.map((m) => m.textContent)).toEqual(['Invite links', 'Present', 'Close', 'Delete']);
    expect(document.activeElement).toBe(items[0]);
    act(() => items[1].click());
    expect(ACTIONS[2].onAction).toHaveBeenCalledTimes(1);
    expect(menu()).toBeNull();
    act(() => more(root)!.click());
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(more(root));
  });

  it('arrows move between rows, Right and Tab reach the controls in a widget row, and Tab past them closes', () => {
    const root = mount(<TopBar title="T" items={ACTIONS.slice(3)} />);
    layout(root, 1, WIDTHS);
    act(() => more(root)!.click());
    const key = (k: string, shiftKey = false) => act(() => {
      (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true }));
    });
    const name = () => (document.activeElement as HTMLElement).getAttribute('aria-label') ?? document.activeElement!.textContent;
    expect(name()).toBe('Close');
    key('ArrowDown');
    expect(name()).toBe('Delete');
    key('ArrowDown');
    expect(name()).toBe('Smaller');
    key('ArrowRight');
    expect(name()).toBe('Larger');
    key('Tab', true);
    expect(name()).toBe('Smaller');
    key('Tab');
    expect(name()).toBe('Larger');
    key('ArrowUp');
    expect(name()).toBe('Delete');
    // The ends wrap, as the SDK's Dropdown can.
    key('ArrowUp');
    key('ArrowUp');
    expect(name()).toBe('Smaller');
    key('ArrowDown');
    expect(name()).toBe('Close');
    key('End');
    key('Tab');
    key('Tab');
    expect(menu()).toBeNull();
  });

  it("typing jumps to the row whose name starts with it, as the SDK's Dropdown does: an action, or a widget's row", () => {
    const root = mount(<TopBar title="T" items={ACTIONS} />);
    layout(root, 1, WIDTHS);
    act(() => more(root)!.click());
    let now = 10_000;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    const key = (k: string) => act(() => {
      (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    });
    const row = () => (document.activeElement as HTMLElement).closest<HTMLElement>('[data-slot="row"]');
    const name = () => row()?.getAttribute('aria-label') ?? row()?.textContent;
    try {
      expect(name()).toBe('Edit');
      key('p');
      expect(name()).toBe('Present');
      now += 2000;
      key('c');
      expect(name()).toBe('Close');
      now += 2000;
      // A widget's row, by its name: focus on its first control.
      key('t');
      expect(name()).toBe('Text size');
      expect(document.activeElement!.getAttribute('aria-label')).toBe('Smaller');
      now += 2000;
      // Keys in quick succession are one search.
      key('d');
      key('e');
      expect(name()).toBe('Delete');
      expect(menu()).toBeTruthy();
    } finally {
      clock.mockRestore();
    }
  });

  it("typing in a widget's field stays in the field", () => {
    const find: TopBarItem = { id: 'find', label: 'Find', priority: 1, place: 'menu', widget: <input aria-label="Find" /> };
    const root = mount(<TopBar title="T" items={[...ACTIONS, find]} zoom={false} />);
    layout(root, 1, WIDTHS);
    act(() => more(root)!.click());
    const field = menu()!.querySelector<HTMLInputElement>('input')!;
    act(() => field.focus());
    const e = new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true });
    act(() => { field.dispatchEvent(e); });
    expect(document.activeElement).toBe(field);
    expect(e.defaultPrevented).toBe(false);
  });

  it('pressing Larger inside the open menu changes the zoom and keeps the menu open', () => {
    const root = mount(<TopBar title="T" />);
    layout(root, 1000, {});
    act(() => more(root)!.click());
    const larger = menu()!.querySelector<HTMLButtonElement>('button[aria-label="Larger"]')!;
    act(() => larger.click());
    expect(zoomState().own).toBe(1.1);
    expect(menu()).toBeTruthy();
    act(() => menu()!.querySelector<HTMLButtonElement>('button[aria-label="Larger"]')!.click());
    expect(zoomState().own).toBe(1.25);
    expect(menu()).toBeTruthy();
    expect(more(root)!.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('<Glyph>', () => {
  it('draws the More and Home shapes', () => {
    const root = mount(<><Glyph shape="more" /><Glyph shape="home" size="sm" /></>);
    const [a, b] = [...root.querySelectorAll('svg[data-boogy="glyph"]')];
    expect(a.querySelectorAll('path, circle').length).toBeGreaterThan(0);
    expect(b.getAttribute('data-size')).toBe('sm');
  });
});
