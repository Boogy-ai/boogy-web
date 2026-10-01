import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { useRef } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { Popover } from './index';

// jsdom has no layout: every box is 0 x 0. Give the trigger and the popup real
// geometry so placement is exercised, in a 1024 x 768 viewport.
let triggerRect = { left: 400, top: 100, width: 100, height: 40 };
const POPUP = { width: 200, height: 300 };
let narrow = false;

beforeEach(() => {
  triggerRect = { left: 400, top: 100, width: 100, height: 40 };
  narrow = false;
  // The popup's bounding rect is SCALED, as it is mid entrance animation
  // (scale 0.96 -> 1): its layout size (offsetWidth) is what placement must use.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const r = this.dataset.boogy === 'popover'
      ? { left: 0, top: 0, width: POPUP.width * 0.96, height: POPUP.height * 0.96 }
      : this.id === 'trigger' ? triggerRect : { left: 0, top: 0, width: 0, height: 0 };
    return { ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON() {} } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.dataset.boogy === 'popover' ? POPUP.width : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.dataset.boogy === 'popover' ? POPUP.height : 0;
  });
  window.matchMedia = ((q: string) => ({
    matches: narrow, media: q, addEventListener() {}, removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

function mount(props: Record<string, unknown> = {}) {
  const onOpenChange = vi.fn();
  const root = document.createElement('div');
  document.body.appendChild(root);
  let open = true;
  function App({ isOpen }: { isOpen: boolean }) {
    const ref = useRef<HTMLButtonElement>(null);
    return (
      <div>
        <button id="trigger" ref={ref}>Set content</button>
        <button id="elsewhere">elsewhere</button>
        <Popover triggerRef={ref} isOpen={isOpen} onOpenChange={onOpenChange} title="Set content" {...props}>
          <input id="field" />
        </Popover>
      </div>
    );
  }
  const draw = () => act(() => render(<App isOpen={open} />, root));
  draw();
  const q = (s: string) => document.querySelector(s) as HTMLElement | null;
  return { q, onOpenChange, setOpen: (v: boolean) => { open = v; draw(); } };
}

describe('<Popover> anchored', () => {
  it('renders nothing while closed', () => {
    const { q, setOpen } = mount();
    setOpen(false);
    expect(q('[data-boogy="popover"]')).toBeNull();
  });

  it('is a labelled dialog in the top layer, placed under its trigger', () => {
    const { q } = mount();
    const p = q('[data-boogy="popover"]')!;
    expect(p.getAttribute('popover')).toBe('manual');
    expect(p.getAttribute('role')).toBe('dialog');
    expect(p.getAttribute('aria-label')).toBe('Set content');
    expect(p.dataset.mode).toBe('anchored');
    expect(p.dataset.placement).toBe('bottom');
    expect(p.style.left).toBe('350px');
    expect(p.style.top).toBe('148px');
    expect(p.style.getPropertyValue('--trigger-width')).toBe('100px');
    // Anchored, it is a menu off its trigger: the title names it, and no head
    // is drawn (a context menu with a title bar and a Close button is not one).
    expect(q('[data-slot="head"]')).toBeNull();
  });

  it('measures its natural width, not the width squeezed by where it last sat', () => {
    // Shrink-to-fit: the popup is only as wide as the room right of its left edge.
    triggerRect = { left: 950, top: 100, width: 60, height: 40 };
    vi.mocked(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!.get!).mockImplementation(function (this: HTMLElement) {
      return this.dataset.boogy === 'popover' ? Math.min(POPUP.width, 1024 - parseFloat(this.style.left || '900')) : 0;
    });
    const { q } = mount();
    // Natural width 200: kept 12 clear of the right edge, 1024 - 12 - 200.
    expect(q('[data-boogy="popover"]')!.style.left).toBe('812px');
  });

  it('flips above a trigger near the bottom of the viewport', () => {
    triggerRect = { left: 400, top: 700, width: 100, height: 40 };
    const { q } = mount();
    expect(q('[data-boogy="popover"]')!.dataset.placement).toBe('top');
  });

  it('passes placement options through', () => {
    const { q } = mount({ placement: 'bottom start', offset: 4 });
    const p = q('[data-boogy="popover"]')!;
    expect(p.style.left).toBe('400px');
    expect(p.style.top).toBe('144px');
  });

  it('Escape closes it', () => {
    const { onOpenChange } = mount();
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('a press outside closes it; a press inside or on the trigger does not', () => {
    const { q, onOpenChange } = mount();
    act(() => { q('#field')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    act(() => { q('#trigger')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    expect(onOpenChange).not.toHaveBeenCalled();
    act(() => { q('#elsewhere')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('moves focus in on open and returns it to the trigger on close', () => {
    const { q, setOpen } = mount();
    expect(document.activeElement).toBe(q('#field'));
    setOpen(false);
    expect(document.activeElement).toBe(q('#trigger'));
  });

  it('leaves focus alone when the content already took it', () => {
    function Autofocus() {
      return <input id="auto" ref={(el) => el?.focus()} />;
    }
    const root = document.createElement('div');
    document.body.appendChild(root);
    function App() {
      const ref = useRef<HTMLButtonElement>(null);
      return (<div><button ref={ref}>t</button>
        <Popover triggerRef={ref} isOpen onOpenChange={() => {}}><input id="first" /><Autofocus /></Popover></div>);
    }
    act(() => render(<App />, root));
    expect(document.activeElement?.id).toBe('auto');
  });
});

describe('<Popover> page mode (small screens)', () => {
  beforeEach(() => { narrow = true; });

  it('opens as a full-screen modal page with a back button and the title', () => {
    const { q } = mount();
    const p = q('[data-boogy="popover"]')!;
    expect(p.dataset.mode).toBe('page');
    expect(p.getAttribute('aria-modal')).toBe('true');
    expect(p.style.left).toBe('');
    expect(q('[data-slot="head"]')!.textContent).toContain('Set content');
    expect(q('[data-slot="head"] [aria-label="Back"]')).not.toBeNull();
  });

  it('the back button closes it', () => {
    const { q, onOpenChange } = mount();
    act(() => q('[data-slot="head"] [aria-label="Back"]')!.click());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // A real traversal: history.state changes to the previous entry, THEN popstate fires.
  const goBack = () => new Promise<void>((resolve) => {
    window.addEventListener('popstate', () => resolve(), { once: true });
    history.back();
  });

  it('pushes a history entry, so the browser back button closes it', async () => {
    const before = history.length;
    const { onOpenChange } = mount();
    expect(history.length).toBe(before + 1);
    await act(goBack);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closing it any other way steps back, so no dead history entry is left', () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    const { setOpen } = mount();
    setOpen(false);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('does not step back after the browser back button already closed it', async () => {
    const { setOpen } = mount();
    await act(goBack);
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    setOpen(false);
    expect(back).not.toHaveBeenCalled();
  });

  it('is anchored when fullscreenBelow is false, whatever the width', () => {
    const { q } = mount({ fullscreenBelow: false });
    expect(q('[data-boogy="popover"]')!.dataset.mode).toBe('anchored');
  });
});

describe('<Popover centered>', () => {
  it('sits in the middle of the viewport, not against its trigger', () => {
    const { q } = mount({ centered: true });
    const p = q('[data-boogy="popover"]')!;
    // 1024 x 768 viewport, 200 x 300 popup.
    expect(p.style.left).toBe('412px');
    expect(p.style.top).toBe('234px');
    expect(p.dataset.placement).toBeUndefined();
  });

  it('can sit higher than the middle: centerY is the share of the free space above it', () => {
    // 768 - 300 = 468 free; a third above it, two thirds below.
    const { q } = mount({ centered: true, centerY: 1 / 3 });
    const p = q('[data-boogy="popover"]')!;
    expect(p.style.top).toBe('156px');
    expect(p.style.left).toBe('412px');
  });

  it('a centerY off the 0..1 range is clamped, never placing it off screen', () => {
    const { q } = mount({ centered: true, centerY: -2 });
    expect(q('[data-boogy="popover"]')!.style.top).toBe('12px');
  });

  it('keeps clear of the viewport edges when taller than it', () => {
    vi.mocked(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')!.get!).mockImplementation(function (this: HTMLElement) {
      return this.dataset.boogy === 'popover' ? 2000 : 0;
    });
    const { q } = mount({ centered: true });
    const p = q('[data-boogy="popover"]')!;
    expect(p.style.top).toBe('12px');
    expect(p.style.maxHeight).toBe('744px');
  });
});

describe('<Popover overlay>', () => {
  it('shows the given element behind the popover, over the page', () => {
    const { q } = mount({ overlay: <div id="scrim" /> });
    const layer = q('[data-boogy="popover-overlay"]')!;
    expect(layer).not.toBeNull();
    expect(layer.getAttribute('popover')).toBe('manual');
    expect(layer.querySelector('#scrim')).not.toBeNull();
    // Behind: it comes BEFORE the popover, and the top layer stacks in the
    // order things were shown.
    expect(layer.compareDocumentPosition(q('[data-boogy="popover"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a press on the overlay closes the popover', () => {
    const { q, onOpenChange } = mount({ overlay: <div id="scrim" /> });
    act(() => { q('#scrim')!.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('is not drawn while closed, nor in the full-screen page', () => {
    const { q, setOpen } = mount({ overlay: <div id="scrim" /> });
    setOpen(false);
    expect(q('[data-boogy="popover-overlay"]')).toBeNull();
    narrow = true;
    const second = mount({ overlay: <div id="scrim2" /> });
    expect(second.q('[data-boogy="popover"]')!.dataset.mode).toBe('page');
    expect(second.q('#scrim2')).toBeNull();
  });
});

describe('<Popover> head', () => {
  it('a centred popover is a dialog, with its title and Close in a head', () => {
    const { q } = mount({ centered: true });
    const head = q('[data-slot="head"]')!;
    expect(head.textContent).toContain('Set content');
    expect(head.querySelector('button[aria-label="Close"]')).not.toBeNull();
    expect(head.querySelector('button[aria-label="Back"]')).toBeNull();
  });
  it('Close closes it', () => {
    const { q, onOpenChange } = mount({ centered: true });
    act(() => { (q('[data-slot="head"] button[aria-label="Close"]') as HTMLButtonElement).click(); });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it('with onBack, a Back button comes first and calls it, not close', () => {
    const onBack = vi.fn();
    const { q, onOpenChange } = mount({ onBack });
    const buttons = [...q('[data-slot="head"]')!.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(buttons).toEqual(['Back', 'Close']);
    act(() => { (q('[data-slot="head"] button[aria-label="Back"]') as HTMLButtonElement).click(); });
    expect(onBack).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
  it('a title icon sits before the title as decoration; the dialog is still named by the title alone', () => {
    const { q } = mount({ centered: true, titleIcon: <svg id="glyph" /> });
    const head = q('[data-slot="head"]')!;
    const slots = [...head.children].map((c) => c.getAttribute('data-slot'));
    expect(slots.indexOf('title-icon')).toBe(slots.indexOf('title') - 1);
    expect(head.querySelector('[data-slot="title-icon"]')!.getAttribute('aria-hidden')).toBe('true');
    expect(head.querySelector('[data-slot="title-icon"] #glyph')).not.toBeNull();
    expect(q('[data-boogy="popover"]')!.getAttribute('aria-label')).toBe('Set content');
  });
  it('no title icon unless one is given', () => {
    const { q } = mount({ centered: true });
    expect(q('[data-slot="title-icon"]')).toBeNull();
  });
  it('no title and anchored: no head at all', () => {
    const { q } = mount({ title: undefined });
    expect(q('[data-slot="head"]')).toBeNull();
  });
});
