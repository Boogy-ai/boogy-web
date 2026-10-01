import { describe, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { DrawerLayout, Drawer, DrawerMain, DrawerItem, DrawerToggle } from './index';

function setup(props: { expanded?: boolean; open?: boolean; mode: 'docked' | 'overlay' }) {
  const onExpandedChange = vi.fn();
  const onOpenChange = vi.fn();
  const root = document.createElement('div');
  document.body.appendChild(root);
  const ui = (p: { expanded?: boolean; open?: boolean }) => (
    <DrawerLayout expanded={p.expanded} open={p.open} onExpandedChange={onExpandedChange} onOpenChange={onOpenChange}>
      <Drawer label="Boards" style={`--boogy-drawer-mode: ${props.mode}`}>
        <DrawerItem as="a" href="#a" label="Scratchpad" current />
        <DrawerItem as="button" label="New board" mark={<b id="plus">+</b>} />
      </Drawer>
      <DrawerMain>
        <DrawerToggle />
      </DrawerMain>
    </DrawerLayout>
  );
  act(() => render(ui(props), root));
  const q = (sel: string) => root.querySelector(sel) as HTMLElement;
  return { root, q, onExpandedChange, onOpenChange, rerender: (p: { expanded?: boolean; open?: boolean }) => act(() => render(ui(p), root)) };
}

describe('DrawerLayout and friends', () => {
  it('renders the layout attributes, a nav landmark, a backdrop and the main area', () => {
    const { q } = setup({ expanded: false, open: true, mode: 'overlay' });
    const layout = q('[data-boogy="drawer-layout"]');
    expect(layout.dataset.expanded).toBe('false');
    expect(layout.dataset.open).toBe('true');
    expect(q('nav[data-boogy="drawer"]').getAttribute('aria-label')).toBe('Boards');
    expect(q('[data-boogy="drawer-backdrop"]')).not.toBeNull();
    expect(q('[data-boogy="drawer-main"]')).not.toBeNull();
  });

  it('gives an item a monogram mark, its label, a tooltip, and the current marker', () => {
    const { q } = setup({ mode: 'docked' });
    const item = q('a[data-boogy="drawer-item"]');
    expect(item.querySelector('[data-slot="mark"]')!.textContent).toBe('Sc');
    expect(item.querySelector('[data-slot="label"]')!.textContent).toBe('Scratchpad');
    expect(item.getAttribute('title')).toBe('Scratchpad');
    expect(item.getAttribute('aria-current')).toBe('page');
  });

  it("wraps the default initials in their own slot, so they can be centred on their capitals", () => {
    const { q } = setup({ mode: 'docked' });
    const item = q('a[data-boogy="drawer-item"]');
    expect(item.querySelector('[data-slot="mark"] > [data-slot="initials"]')!.textContent).toBe('Sc');
  });

  it('uses a custom mark when one is given', () => {
    const { q } = setup({ mode: 'docked' });
    expect(q('button[data-boogy="drawer-item"] [data-slot="mark"] #plus')).not.toBeNull();
  });

  it('renders no mark at all when mark={false}, for an app with no logo yet', () => {
    const root = document.createElement('div');
    act(() => render(
      <DrawerLayout><Drawer label="Boards"><DrawerItem as="a" href="#" variant="title" label="Boards" mark={false} /></Drawer></DrawerLayout>,
      root));
    const item = root.querySelector('[data-boogy="drawer-item"]')!;
    expect(item.querySelector('[data-slot="mark"]')).toBeNull();
    expect(item.querySelector('[data-slot="label"]')!.textContent).toBe('Boards');
  });

  it('the toggle draws a chevron by default, and a caller can replace it', () => {
    const { q } = setup({ mode: 'docked' });
    const chevron = q('[data-role="drawer-toggle"] [data-slot="chevron"]');
    expect(chevron.tagName.toLowerCase()).toBe('svg');
    expect(chevron.getAttribute('aria-hidden')).toBe('true');
    const root = document.createElement('div');
    act(() => render(<DrawerLayout><Drawer label="x" /><DrawerToggle><i id="menu" /></DrawerToggle></DrawerLayout>, root));
    expect(root.querySelector('[data-role="drawer-toggle"] #menu')).not.toBeNull();
    expect(root.querySelector('[data-slot="chevron"]')).toBeNull();
  });

  it('animate={false} reaches the layout element', () => {
    const root = document.createElement('div');
    act(() => render(<DrawerLayout animate={false}><Drawer label="x" /></DrawerLayout>, root));
    expect((root.firstElementChild as HTMLElement).dataset.animate).toBe('false');
  });

  it('docked: the toggle expands and collapses', () => {
    const { q, onExpandedChange, onOpenChange } = setup({ expanded: true, mode: 'docked' });
    const toggle = q('[data-role="drawer-toggle"]');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    act(() => toggle.click());
    expect(onExpandedChange).toHaveBeenCalledWith(false);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('overlay: the toggle opens and closes', () => {
    const { q, onExpandedChange, onOpenChange } = setup({ open: false, mode: 'overlay' });
    act(() => q('[data-role="drawer-toggle"]').click());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(onExpandedChange).not.toHaveBeenCalled();
  });

  it('overlay: Escape and the backdrop close it', () => {
    const { q, onOpenChange } = setup({ open: true, mode: 'overlay' });
    act(() => { q('nav').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    onOpenChange.mockClear();
    act(() => q('[data-boogy="drawer-backdrop"]').click());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('overlay: opening moves focus into the drawer, closing returns it to the toggle', () => {
    const { q, rerender } = setup({ open: false, mode: 'overlay' });
    q('[data-role="drawer-toggle"]').focus();
    rerender({ open: true });
    expect(q('nav').contains(document.activeElement)).toBe(true);
    rerender({ open: false });
    expect(document.activeElement).toBe(q('[data-role="drawer-toggle"]'));
  });

  it('overlay: Tab wraps inside the open drawer', () => {
    const { q } = setup({ open: true, mode: 'overlay' });
    const last = q('button[data-boogy="drawer-item"]');
    last.focus();
    act(() => { last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })); });
    expect(document.activeElement).toBe(q('a[data-boogy="drawer-item"]'));
  });
});

describe('DrawerLayout resizable', () => {
  function mount(props: Record<string, unknown> = {}) {
    const onWidthChange = vi.fn();
    const root = document.createElement('div');
    document.body.appendChild(root);
    act(() => render(
      <DrawerLayout resizable width={240} minWidth={160} maxWidth={400} onWidthChange={onWidthChange} {...props}>
        <Drawer label="Boards" />
        <DrawerMain />
      </DrawerLayout>, root));
    const layout = root.querySelector('[data-boogy="drawer-layout"]') as HTMLElement;
    layout.getBoundingClientRect = () => ({ left: 0, right: 1000, width: 1000, top: 0, bottom: 800, height: 800, x: 0, y: 0, toJSON() {} });
    const handle = root.querySelector('[data-boogy="drawer-resizer"]') as HTMLElement;
    const pointer = (type: string, clientX: number) =>
      act(() => { handle.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true })); });
    return { root, layout, handle, pointer, onWidthChange };
  }

  it('has no handle unless resizable', () => {
    const root = document.createElement('div');
    act(() => render(<DrawerLayout><Drawer label="x" /></DrawerLayout>, root));
    expect(root.querySelector('[data-boogy="drawer-resizer"]')).toBeNull();
  });

  it('renders the edge as a vertical separator and applies the width', () => {
    const { layout, handle } = mount();
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-label')).toBe('Resize navigation');
    expect(handle.getAttribute('aria-valuenow')).toBe('240');
    expect(layout.style.getPropertyValue('--drawer-width')).toBe('240px');
    expect(layout.dataset.resizable).toBe('true');
  });

  it('a drag moves the edge live and reports the width once, on release', () => {
    const { layout, pointer, onWidthChange } = mount();
    pointer('pointerdown', 240);
    expect(layout.dataset.resizing).toBe('true');
    pointer('pointermove', 300);
    pointer('pointermove', 320);
    expect(layout.style.getPropertyValue('--drawer-width')).toBe('320px');
    expect(onWidthChange).not.toHaveBeenCalled();
    pointer('pointerup', 320);
    expect(onWidthChange).toHaveBeenCalledTimes(1);
    expect(onWidthChange).toHaveBeenCalledWith(320);
    expect(layout.dataset.resizing).toBeUndefined();
  });

  it('a move without a press does nothing', () => {
    const { layout, pointer, onWidthChange } = mount();
    pointer('pointermove', 330);
    pointer('pointerup', 330);
    expect(layout.style.getPropertyValue('--drawer-width')).toBe('240px');
    expect(onWidthChange).not.toHaveBeenCalled();
  });

  it('clamps to minWidth and maxWidth', () => {
    const { pointer, onWidthChange } = mount();
    pointer('pointerdown', 240); pointer('pointermove', 20); pointer('pointerup', 20);
    expect(onWidthChange).toHaveBeenLastCalledWith(160);
    pointer('pointerdown', 160); pointer('pointermove', 900); pointer('pointerup', 900);
    expect(onWidthChange).toHaveBeenLastCalledWith(400);
  });

  it('an end-side drawer measures from the right edge', () => {
    const { pointer, onWidthChange } = mount({ side: 'end' });
    pointer('pointerdown', 760); pointer('pointermove', 700); pointer('pointerup', 700);
    expect(onWidthChange).toHaveBeenCalledWith(300);
  });

  it('arrow keys step by 5% of the layout, toward the edge they point at', () => {
    const { handle, onWidthChange } = mount();
    act(() => { handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    expect(onWidthChange).toHaveBeenLastCalledWith(290);
    act(() => { handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); });
    expect(onWidthChange).toHaveBeenLastCalledWith(190);
  });
});
