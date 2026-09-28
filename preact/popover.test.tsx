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
    expect(q('[data-slot="page-head"]')).toBeNull();
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
    expect(q('[data-slot="page-head"]')!.textContent).toContain('Set content');
    expect(q('[data-slot="page-head"] [aria-label="Back"]')).not.toBeNull();
  });

  it('the back button closes it', () => {
    const { q, onOpenChange } = mount();
    act(() => q('[data-slot="page-head"] [aria-label="Back"]')!.click());
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
