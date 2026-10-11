import { describe, it, expect, vi, afterEach, beforeEach, beforeAll } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { resetZoom, zoomState } from '@boogy/web';
import { flushRounds, setFrameScheduler } from '../src/components/measure';
import { useState } from 'preact/hooks';
import { Button, ColorPicker, Dropdown, Glyph, TopBar, type TopBarItem } from './index';

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

  it('an action with an icon is an icon-only button in the bar, named by its label, and leads its menu row with the icon', () => {
    const icon = <svg data-testid="i" />;
    const items: TopBarItem[] = [
      { id: 'a', label: 'Split', priority: 1, icon, onAction: vi.fn() },
      { id: 'b', label: 'Copy link', priority: 2, place: 'menu', icon, onAction: vi.fn() },
    ];
    const root = mount(<TopBar title="T" items={items} zoom={false} />);
    layout(root, 1000, { a: 30 });
    const inBar = root.querySelector<HTMLButtonElement>('[data-slot="actions"] [data-item="a"] button')!;
    expect(inBar.getAttribute('data-shape')).toBe('icon');
    expect(inBar.getAttribute('aria-label')).toBe('Split');
    expect(inBar.querySelector('[data-testid="i"]')).toBeTruthy();
    act(() => more(root)!.click());
    const row = menu()!.querySelector<HTMLElement>('[role="menuitem"]')!;
    expect(row.querySelector('[data-slot="icon"] [data-testid="i"]')).toBeTruthy();
    expect(row.querySelector('[data-slot="label"]')!.textContent).toBe('Copy link');
  });

  it("a widget with an icon leads its menu row with the glyph, before its label; one without has none", () => {
    const icon = <svg data-testid="wi" />;
    const items: TopBarItem[] = [
      { id: 'w', label: 'Size', priority: 1, place: 'menu', icon, widget: <button>compact</button> },
      { id: 'v', label: 'Other', priority: 2, place: 'menu', widget: <button>same</button> },
    ];
    const root = mount(<TopBar title="T" items={items} zoom={false} />);
    layout(root, 1000, {});
    act(() => more(root)!.click());
    const [withIcon, without] = [...menu()!.querySelectorAll<HTMLElement>('[role="group"][data-slot="row"]')];
    const ic = withIcon.querySelector<HTMLElement>('[data-slot="icon"]')!;
    expect(ic.querySelector('[data-testid="wi"]')).toBeTruthy();
    expect(ic.getAttribute('aria-hidden')).toBe('true');
    expect(ic.compareDocumentPosition(withIcon.querySelector('[data-slot="label"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(without.querySelector('[data-slot="icon"]')).toBeNull();
    expect(withIcon.querySelectorAll('button').length).toBe(1);
  });

  it("a widget's menu form is what its menu row holds; without one the row holds the widget", () => {
    const items: TopBarItem[] = [
      { id: 'w', label: 'Size', priority: 1, place: 'menu', widget: <button>compact</button>, menu: <button>expanded</button> },
      { id: 'v', label: 'Other', priority: 2, place: 'menu', widget: <button>same</button> },
    ];
    const root = mount(<TopBar title="T" items={items} zoom={false} />);
    layout(root, 1000, {});
    act(() => more(root)!.click());
    const rows = [...menu()!.querySelectorAll('[role="group"]')].map((r) => r.querySelector('[data-slot="widget"]')!.textContent);
    expect(rows).toEqual(['expanded', 'same']);
  });

  it('More shows the moreGlyph when given, else the SDK glyph', () => {
    const items: TopBarItem[] = [{ id: 'c', label: 'Copy link', priority: 1, place: 'menu', onAction: vi.fn() }];
    const root = mount(<TopBar title="T" items={items} zoom={false} moreGlyph={<svg data-testid="ack" />} />);
    layout(root, 1000, {});
    expect(more(root)!.querySelector('[data-testid="ack"]')).toBeTruthy();
    const plain = mount(<TopBar title="T" items={items} zoom={false} />);
    layout(plain, 1000, {});
    expect(more(plain)!.querySelector('svg[data-boogy="glyph"]')).toBeTruthy();
  });
});

describe('<TopBar> menuVariant', () => {
  const variantOf = (props: Record<string, unknown>) => {
    const root = mount(<TopBar title="T" items={ACTIONS} zoom={false} {...props} />);
    layout(root, 100, WIDTHS);
    act(() => more(root)!.click());
    return document.querySelector<HTMLElement>('[data-boogy="popover"]')!.dataset.variant;
  };
  it('the More menu is flat (edged, frosted, a small shadow) by default, raised when menuVariant says so', () => {
    expect(variantOf({})).toBe('flat');
    document.body.innerHTML = '';
    expect(variantOf({ menuVariant: 'raised' })).toBe('raised');
  });
  it('menuGround is the ground of More', () => {
    const root = mount(<TopBar title="T" items={ACTIONS} zoom={false} menuGround="var(--x-ground)" />);
    layout(root, 100, WIDTHS);
    act(() => more(root)!.click());
    expect(document.querySelector<HTMLElement>('[data-boogy="popover"]')!.style.getPropertyValue('--popover-ground')).toBe('var(--x-ground)');
  });
});

// A widget whose menu form is the SDK's Dropdown: the list opens inside More's
// row, so its key presses pass through More's menu on their way to the page.
describe('<TopBar> with a Dropdown in a menu row', () => {
  function Colours() {
    return (
      <Dropdown>
        <Dropdown.Trigger>
          <Button variant="quiet" shape="icon" size="sm" label="Colour">c</Button>
        </Dropdown.Trigger>
        <Dropdown.Popover>
          <Dropdown.Menu aria-label="Colours" selectionMode="single">
            {['Red', 'Green', 'Sky'].map((c) => (
              <Dropdown.Item key={c} id={c}><span data-slot="label">{c}</span></Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    );
  }
  // More's rows: "Split", then the Colour row, then "Stack". "Split" and
  // "Sky" share a first letter, so a typed "s" means something to both menus.
  const ITEMS: TopBarItem[] = [
    { id: 'split', label: 'Split', priority: 1, place: 'menu', onAction: vi.fn() },
    { id: 'colour', label: 'Colour', priority: 2, place: 'menu', widget: <span />, menu: <Colours /> },
    { id: 'stack', label: 'Stack', priority: 3, place: 'menu', onAction: vi.fn() },
  ];
  const key = (k: string) => act(() => {
    (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  });
  const trigger = () => document.querySelector<HTMLButtonElement>('button[aria-label="Colour"]')!;
  const colours = () => document.querySelector<HTMLElement>('[role="menu"][aria-label="Colours"]');
  /** More open, then the colour list opened from its trigger by ArrowDown: on "Red". */
  function openBoth() {
    const root = mount(<TopBar title="T" items={ITEMS} zoom={false} />);
    layout(root, 1000, {});
    act(() => more(root)!.click());
    act(() => trigger().focus());
    key('ArrowDown');
    expect(colours()).toBeTruthy();
    expect(document.activeElement!.textContent).toBe('Red');
    return root;
  }

  it("ArrowDown in the list steps to its second item, and More's rows are untouched", () => {
    const root = openBoth();
    key('ArrowDown');
    expect(document.activeElement!.textContent).toBe('Green');
    expect(colours()).toBeTruthy();
    expect(menu()).toBeTruthy();
    expect(more(root)!.getAttribute('aria-expanded')).toBe('true');
  });

  it("a letter typed in the list searches the list, not More's rows", () => {
    openBoth();
    key('s');
    expect(document.activeElement!.textContent).toBe('Sky');
    expect(colours()).toBeTruthy();
  });

  it('Escape closes only the list, leaving More open with focus on its trigger; the next Escape closes More', () => {
    const root = openBoth();
    key('Escape');
    expect(colours()).toBeNull();
    expect(menu()).toBeTruthy();
    expect(more(root)!.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(trigger());
    key('Escape');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(more(root));
  });
});

// A widget whose menu form opens a popover of its own controls (a colour
// picker): those controls are the popover's, not More's rows. More must not
// rewrite them, step through them, or search from them.
describe('<TopBar> with a popover of controls opened from a menu row', () => {
  const SWATCHES = Array.from({ length: 14 }, (_, i) => ({ id: `c${i}`, label: `Colour ${i}`, color: `var(--c${i})` }));
  function Picker() {
    const [value, setValue] = useState('c3');
    return (
      <Dropdown>
        <Dropdown.Trigger>
          <Button variant="quiet" shape="icon" size="sm" label="Colour">c</Button>
        </Dropdown.Trigger>
        <Dropdown.Popover>
          <ColorPicker label="Fill" swatches={SWATCHES} value={value} onValueChange={setValue} opacity={33} onOpacityChange={() => {}} />
        </Dropdown.Popover>
      </Dropdown>
    );
  }
  const ITEMS: TopBarItem[] = [
    { id: 'split', label: 'Split', priority: 1, place: 'menu', onAction: vi.fn() },
    { id: 'colour', label: 'Colour', priority: 2, place: 'menu', widget: <span />, menu: <Picker /> },
    { id: 'stack', label: 'Stack', priority: 3, place: 'menu', onAction: vi.fn() },
  ];
  const key = (k: string, init: KeyboardEventInit = {}) => act(() => {
    (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  });
  const trigger = () => document.querySelector<HTMLButtonElement>('button[aria-label="Colour"]')!;
  const picker = () => document.querySelector<HTMLElement>('[data-boogy="color-picker"]');
  const swatches = () => [...document.querySelectorAll<HTMLButtonElement>('[data-boogy="color-picker"] [data-slot="swatch"]')];
  /** The custom colour's controls: the area, the hue strip, the hex field. */
  const custom = () => [...document.querySelectorAll<HTMLElement>('[data-boogy="color-picker"] :is([data-slot="area"], [data-slot="hue"], [data-slot="hex"])')];
  /** The picker's last control: the transparency slider. */
  const slider = () => document.querySelector<HTMLInputElement>('[data-boogy="color-picker"] [data-slot="opacity"] input')!;
  /** More open, then the picker opened from its row: focus on the chosen swatch. */
  function openBoth() {
    const root = mount(<TopBar title="T" items={ITEMS} zoom={false} />);
    layout(root, 1000, {});
    act(() => more(root)!.click());
    act(() => trigger().focus());
    act(() => trigger().click());
    expect(picker()).toBeTruthy();
    expect(document.activeElement).toBe(swatches()[3]);
    return root;
  }

  it("a re-render of the bar leaves the picker's controls as they are; More's own row control is still its item", () => {
    const root = openBoth();
    act(() => render(<TopBar title="T again" items={ITEMS} zoom={false} />, root));
    expect(picker()).toBeTruthy();
    expect(swatches().map((b) => b.tabIndex)).toEqual(swatches().map((_, i) => (i === 3 ? 0 : -1)));
    expect(custom()).toHaveLength(3);
    for (const el of [...swatches(), ...custom(), slider()]) expect(el.getAttribute('role'), el.outerHTML).not.toBe('menuitem');
    for (const el of [...custom(), slider()]) expect(el.tabIndex, el.outerHTML).toBe(0);
    expect(trigger().getAttribute('role')).toBe('menuitem');
    expect(trigger().tabIndex).toBe(-1);
  });

  it('Tab inside the picker is not More\'s: it neither steps to another swatch nor closes More', () => {
    const root = openBoth();
    key('Tab');
    expect(document.activeElement).toBe(swatches()[3]);
    expect(picker()).toBeTruthy();
    expect(menu()).toBeTruthy();
    expect(more(root)!.getAttribute('aria-expanded')).toBe('true');
  });

  it("Tab cycles inside the picker's popover: past the slider back to the chosen swatch, and Shift+Tab the other way", () => {
    openBoth();
    act(() => slider().focus());
    key('Tab');
    expect(document.activeElement).toBe(swatches()[3]);
    expect(menu()).toBeTruthy();
    key('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(slider());
    expect(menu()).toBeTruthy();
  });

  it("a letter typed on a swatch does not search More's rows", () => {
    openBoth();
    key('s');
    expect(document.activeElement).toBe(swatches()[3]);
    expect(picker()).toBeTruthy();
  });

  it("with the picker closed again, More's own rows still step and search, its row control among them", () => {
    const root = openBoth();
    key('Escape');
    expect(picker()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    act(() => [...menu()!.querySelectorAll<HTMLElement>('[data-slot="row"]')].find((r) => r.textContent === 'Split')!.focus());
    key('ArrowDown');
    expect(document.activeElement).toBe(trigger());
    key('s');
    expect(document.activeElement!.textContent).toBe('Stack');
    expect(more(root)!.getAttribute('aria-expanded')).toBe('true');
  });
});

// A submenu item: a glyph and a label that open content of the caller's own
// (here the SDK's ColorPicker, which steps its own grid with the arrows). In
// the bar it is an icon-only button opening the content below it; in More it
// is ONE row, the row itself the control, opening the content to its side.
describe('<TopBar> submenu items', () => {
  const SWATCHES = Array.from({ length: 14 }, (_, i) => ({ id: `c${i}`, label: `Colour ${i}`, color: `var(--c${i})` }));
  function Picker() {
    const [value, setValue] = useState('c3');
    return <ColorPicker label="Fill" swatches={SWATCHES} value={value} onValueChange={setValue} />;
  }
  /** Content that handles no key itself: two plain buttons. */
  const Plain = () => <div><button>One</button><button>Two</button></div>;
  const icon = <svg data-testid="tint-icon" />;
  const items = (submenu: preact.ComponentChildren, place: 'menu' | 'bar' = 'menu'): TopBarItem[] => [
    { id: 'split', label: 'Split', priority: 1, place: 'menu', onAction: vi.fn() },
    { id: 'tint', label: 'Tint', priority: 2, place, icon, submenu },
    { id: 'stack', label: 'Stack', priority: 3, place: 'menu', onAction: vi.fn() },
  ];
  const key = (k: string, init: KeyboardEventInit = {}) => act(() => {
    (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  });
  const row = () => [...menu()!.querySelectorAll<HTMLElement>('[data-slot="row"]')].find((r) => r.textContent === 'Tint')!;
  const popovers = () => [...document.querySelectorAll<HTMLElement>('[data-boogy="popover"]')];
  /** The popover the submenu opened in: the one inside More's menu. */
  const submenu = () => popovers().find((p) => menu()?.contains(p)) ?? null;
  const swatches = () => [...document.querySelectorAll<HTMLButtonElement>('[data-boogy="color-picker"] [data-slot="swatch"]')];
  /** More open, focus on the submenu's row. */
  function openMore(content: preact.ComponentChildren = <Picker />, props: Record<string, unknown> = {}) {
    const root = mount(<TopBar title="T" items={items(content)} zoom={false} {...props} />);
    layout(root, 1000, {});
    act(() => more(root)!.click());
    act(() => row().focus());
    return root;
  }

  it('in the bar it is an icon-only button named by its label, that opens its content below it with focus inside', () => {
    const root = mount(<TopBar title="T" items={items(<Picker />, 'bar')} zoom={false} menuVariant="flat" />);
    layout(root, 1000, { tint: 30 });
    expect(barItems(root)).toEqual(['tint']);
    const button = root.querySelector<HTMLButtonElement>('[data-slot="actions"] [data-item="tint"] button')!;
    expect(button.getAttribute('data-shape')).toBe('icon');
    expect(button.getAttribute('aria-label')).toBe('Tint');
    expect(button.querySelector('[data-testid="tint-icon"]')).toBeTruthy();
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[data-boogy="color-picker"]')).toBeNull();
    act(() => button.click());
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const pop = popovers()[0];
    expect(pop.querySelector('[data-boogy="color-picker"]')).toBeTruthy();
    expect(pop.dataset.placement).toBe('bottom');
    expect(pop.dataset.variant).toBe('flat');
    expect(document.activeElement).toBe(swatches()[3]);
    key('Escape');
    expect(popovers()).toEqual([]);
    expect(document.activeElement).toBe(button);
  });

  it('in More it is ONE row, the row itself the control: a menuitem marked as opening a dialog, its glyph, its label and a right chevron, no control inside', () => {
    openMore();
    const r = row();
    expect(r.getAttribute('role')).toBe('menuitem');
    expect(r.getAttribute('aria-haspopup')).toBe('dialog');
    expect(r.getAttribute('aria-expanded')).toBe('false');
    expect(r.querySelector('[data-slot="icon"] [data-testid="tint-icon"]')).toBeTruthy();
    expect(r.querySelector('[data-slot="label"]')!.textContent).toBe('Tint');
    const chevron = r.querySelector<HTMLElement>('[data-slot="submenu-indicator"]')!;
    expect(chevron.getAttribute('aria-hidden')).toBe('true');
    expect(chevron.querySelector('svg[data-boogy="glyph"]')).toBeTruthy();
    // The chevron is the row's last part.
    expect(r.lastElementChild).toBe(chevron);
    expect(r.querySelectorAll('button, input, select, textarea, a[href]')).toHaveLength(0);
    // The content is not there until it is opened.
    expect(document.querySelector('[data-boogy="color-picker"]')).toBeNull();
  });

  for (const [how, open] of [
    ['a click', () => act(() => row().click())],
    ['Enter', () => key('Enter')],
    ['Space', () => key(' ')],
    ['ArrowRight', () => key('ArrowRight')],
  ] as const) {
    it(`${how} on the row opens the content in a popover to the row's side, focus inside, More still open`, () => {
      const root = openMore(<Picker />, { menuVariant: 'flat', menuGround: 'var(--x-ground)' });
      open();
      expect(row().getAttribute('aria-expanded')).toBe('true');
      const pop = submenu()!;
      // A submenu takes More's ground too.
      expect(pop.style.getPropertyValue('--popover-ground')).toBe('var(--x-ground)');
      expect(pop.querySelector('[data-boogy="color-picker"]')).toBeTruthy();
      expect(pop.dataset.placement).toBe('right');
      expect(pop.dataset.variant).toBe('flat');
      expect(pop.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(swatches()[3]);
      expect(menu()).toBeTruthy();
      expect(more(root)!.getAttribute('aria-expanded')).toBe('true');
      // The popover is not inside the row: a press in the content is the content's.
      expect(row().contains(pop)).toBe(false);
    });
  }

  it('a second click on the row closes it again, and More stays open', () => {
    const root = openMore();
    act(() => row().click());
    expect(submenu()).toBeTruthy();
    act(() => row().click());
    expect(submenu()).toBeNull();
    expect(row().getAttribute('aria-expanded')).toBe('false');
    expect(more(root)!.getAttribute('aria-expanded')).toBe('true');
  });

  it('a press inside the content leaves it open', () => {
    openMore(<Plain />);
    key('Enter');
    const one = submenu()!.querySelector('button')!;
    act(() => one.click());
    expect(submenu()).toBeTruthy();
    expect(row().getAttribute('aria-expanded')).toBe('true');
  });

  it('Escape closes it and gives focus back to the row, More staying open; a second Escape closes More', () => {
    const root = openMore();
    key('Enter');
    expect(submenu()).toBeTruthy();
    key('Escape');
    expect(submenu()).toBeNull();
    expect(menu()).toBeTruthy();
    expect(more(root)!.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(row());
    expect(row().getAttribute('aria-expanded')).toBe('false');
    key('Escape');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(more(root));
  });

  it('ArrowLeft the content does not handle closes it and gives focus back to the row, More staying open', () => {
    const root = openMore(<Plain />);
    key('ArrowRight');
    expect(document.activeElement!.textContent).toBe('One');
    key('ArrowLeft');
    expect(submenu()).toBeNull();
    expect(document.activeElement).toBe(row());
    expect(more(root)!.getAttribute('aria-expanded')).toBe('true');
    // More's own arrows work again from the row.
    key('ArrowDown');
    expect(document.activeElement!.textContent).toBe('Stack');
  });

  it("the content's own arrow keys are its own: ArrowLeft steps its grid and leaves it open; ArrowDown does not move More", () => {
    const root = openMore();
    key('Enter');
    expect(document.activeElement).toBe(swatches()[3]);
    key('ArrowLeft');
    expect(document.activeElement).toBe(swatches()[2]);
    expect(submenu()).toBeTruthy();
    key('ArrowRight');
    expect(document.activeElement).toBe(swatches()[3]);
    key('ArrowDown');
    expect(submenu()!.contains(document.activeElement)).toBe(true);
    expect(document.activeElement!.closest('[data-slot="row"]')).toBeNull();
    key('s');
    expect(submenu()!.contains(document.activeElement)).toBe(true);
    expect(more(root)!.getAttribute('aria-expanded')).toBe('true');
  });

  it('ArrowLeft in a text field of the content moves its caret and leaves the content open', () => {
    openMore();
    key('Enter');
    const hex = submenu()!.querySelector<HTMLInputElement>('[data-slot="hex"]')!;
    act(() => hex.focus());
    const e = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    act(() => { hex.dispatchEvent(e); });
    expect(e.defaultPrevented).toBe(false);
    expect(submenu()).toBeTruthy();
    expect(document.activeElement).toBe(hex);
  });

  it('a pointer moving over the row does not open it: a click does', () => {
    openMore();
    act(() => { row().dispatchEvent(new Event('pointermove', { bubbles: true })); });
    expect(submenu()).toBeNull();
    expect(row().getAttribute('aria-expanded')).toBe('false');
  });

  it('while it is open, pointing back at the row leaves focus in the content', () => {
    openMore();
    key('Enter');
    expect(document.activeElement).toBe(swatches()[3]);
    act(() => { row().dispatchEvent(new Event('pointermove', { bubbles: true })); });
    expect(document.activeElement).toBe(swatches()[3]);
  });

  it("More's keys still step over the row and search it by its label", () => {
    openMore();
    act(() => [...menu()!.querySelectorAll<HTMLElement>('[data-slot="row"]')][0].focus());
    key('ArrowDown');
    expect(document.activeElement).toBe(row());
    key('ArrowDown');
    expect(document.activeElement!.textContent).toBe('Stack');
    key('t');
    expect(document.activeElement).toBe(row());
    expect(submenu()).toBeNull();
  });

  it('while it is open, pointing at another row of More closes it and that row takes focus', () => {
    openMore();
    key('Enter');
    expect(submenu()).toBeTruthy();
    const stack = [...menu()!.querySelectorAll<HTMLElement>('[data-slot="row"]')].find((r) => r.textContent === 'Stack')!;
    act(() => { stack.dispatchEvent(new Event('pointermove', { bubbles: true })); });
    expect(submenu()).toBeNull();
    expect(row().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(stack);
  });

  it('while it is open, focus landing on another row of More closes it', () => {
    openMore();
    key('Enter');
    expect(submenu()).toBeTruthy();
    const split = [...menu()!.querySelectorAll<HTMLElement>('[data-slot="row"]')].find((r) => r.textContent === 'Split')!;
    act(() => split.focus());
    expect(submenu()).toBeNull();
    expect(document.activeElement).toBe(split);
  });

  it('focus moving inside the open content, or onto its own row, leaves it open', () => {
    openMore(<Plain />);
    key('Enter');
    const two = submenu()!.querySelectorAll('button')[1];
    act(() => two.focus());
    expect(submenu()).toBeTruthy();
    act(() => row().focus());
    expect(submenu()).toBeTruthy();
  });

  it('ArrowRight with Alt, Ctrl or Meta does not open it and is not prevented', () => {
    openMore();
    for (const mod of ['altKey', 'ctrlKey', 'metaKey'] as const) {
      const e = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true, [mod]: true });
      act(() => { row().dispatchEvent(e); });
      expect(e.defaultPrevented, mod).toBe(false);
      expect(submenu(), mod).toBeNull();
    }
  });

  it('ArrowLeft with Alt, Ctrl or Meta in the content does not close it and is not prevented', () => {
    openMore(<Plain />);
    key('ArrowRight');
    for (const mod of ['altKey', 'ctrlKey', 'metaKey'] as const) {
      const e = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true, [mod]: true });
      act(() => { document.activeElement!.dispatchEvent(e); });
      expect(e.defaultPrevented, mod).toBe(false);
      expect(submenu(), mod).toBeTruthy();
    }
  });
});

describe('<Glyph>', () => {
  it('draws the text-smaller and text-larger shapes: a letter and an arrow beside it, down and up', () => {
    const root = mount(<><Glyph shape="text-smaller" /><Glyph shape="text-larger" /></>);
    const [a, b] = [...root.querySelectorAll('svg[data-boogy="glyph"]')];
    expect(a.querySelectorAll('path').length).toBeGreaterThanOrEqual(2);
    expect(b.querySelectorAll('path').length).toBeGreaterThanOrEqual(2);
    expect(a.innerHTML).not.toBe(b.innerHTML);
  });
  it('draws the forward shape: the back chevron, turned to point ahead', () => {
    const root = mount(<Glyph shape="forward" size="sm" />);
    expect(root.querySelector('svg[data-boogy="glyph"] path')!.getAttribute('d')).toBe('m9 18 6-6-6-6');
  });
  it("tab switcher mode: `tabs` puts a tab row in the heading, in the title's place", () => {
    const tabs = { label: 'Squad', items: [{ id: 'a', label: 'Buddies' }, { id: 'b', label: 'Settings' }], selected: 'a', onSelect: () => {}, panel: 'home', fill: true };
    const bar = mount(<TopBar tabs={tabs} zoom={false} />).querySelector('[data-boogy="top-bar"]')!;
    const list = bar.querySelector(':scope > [data-slot="heading"] > [data-boogy="tab-list"]')!;
    expect(list.getAttribute('aria-label')).toBe('Squad');
    expect(list.getAttribute('data-fill')).toBe('true');
    expect([...list.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Buddies', 'Settings']);
    expect(bar.querySelector('[data-slot="title"]')).toBeNull();
  });
  it('casts a shadow below it only when asked: `shadow`', () => {
    const plain = mount(<TopBar title="Chats" zoom={false} />).querySelector('[data-boogy="top-bar"]')!;
    expect(plain.hasAttribute('data-shadow')).toBe(false);
    const raised = mount(<TopBar title="Chats" zoom={false} shadow />).querySelector('[data-boogy="top-bar"]')!;
    expect(raised.getAttribute('data-shadow')).toBe('');
  });
  it("draws More as three dots stacked: the vertical overflow button", () => {
    const root = mount(<Glyph shape="more" />);
    // Each dot starts at its centre-left: one column, three rows.
    const starts = [...root.querySelectorAll('svg[data-boogy="glyph"] path')].map((p) => /^M(\d+) (\d+)/.exec(p.getAttribute('d')!)!.slice(1).map(Number));
    expect(starts).toHaveLength(3);
    expect(new Set(starts.map(([x]) => x)).size).toBe(1);
    expect(starts.map(([, y]) => y)).toEqual([4, 11, 18]);
  });
  it('draws the More and Home shapes', () => {
    const root = mount(<><Glyph shape="more" /><Glyph shape="home" size="sm" /></>);
    const [a, b] = [...root.querySelectorAll('svg[data-boogy="glyph"]')];
    expect(a.querySelectorAll('path, circle').length).toBeGreaterThan(0);
    expect(b.getAttribute('data-size')).toBe('sm');
  });
});
