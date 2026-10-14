import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { SidePanel, type SidePanelProps } from './index';

let host: HTMLElement | null = null;
function mount(props: Partial<SidePanelProps> & { onOpenChange?: (o: boolean) => void }, body = <button id="first">First</button>) {
  host = document.createElement('div');
  document.body.append(host);
  const p: SidePanelProps = { isOpen: true, onOpenChange: () => {}, label: 'Board Settings', title: 'Board Settings', ...props };
  act(() => render(<SidePanel {...p}>{body}</SidePanel>, host!));
  return host;
}
const panel = () => document.querySelector('[data-boogy="side-panel"]') as HTMLElement | null;
const dialog = () => panel()!.querySelector('[role="dialog"]') as HTMLElement;
const key = (k: string, shiftKey = false) => act(() => { document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true })); });

afterEach(() => { if (host) { act(() => render(null, host!)); host.remove(); host = null; } });

describe('<SidePanel>', () => {
  it('bordered: marked for the edge it draws beside the page; unmarked by default', () => {
    mount({ bordered: true });
    expect(panel()!.hasAttribute('data-bordered')).toBe(true);
    act(() => render(null, document.body.firstElementChild!));
    mount({});
    expect(panel()!.hasAttribute('data-bordered')).toBe(false);
  });

  it('closed, it draws nothing', () => {
    mount({ isOpen: false });
    expect(panel()).toBeNull();
  });

  it('open: a modal dialog named by its label, holding a Sheet whose head ends with Close', () => {
    mount({ glyph: <svg id="glyph" />, end: <button id="extra">More</button>, foot: <button id="ok">Done</button>, onBack: () => {} });
    const d = dialog();
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-label')).toBe('Board Settings');
    const sheet = d.querySelector(':scope > [data-boogy="sheet"]')!;
    const head = sheet.querySelector(':scope > [data-slot="head"]')!;
    expect(head.firstElementChild!.getAttribute('aria-label')).toBe('Back');
    expect(head.querySelector('#glyph')).toBeTruthy();
    expect(head.querySelector('[data-slot="title"]')!.textContent).toBe('Board Settings');
    const end = head.querySelector(':scope > [data-slot="end"]')!;
    expect(end.firstElementChild!.id).toBe('extra');
    expect(end.lastElementChild!.getAttribute('aria-label')).toBe('Close');
    expect(sheet.querySelector(':scope > [data-slot="foot"] #ok')).toBeTruthy();
  });

  it('Close and Escape each ask to close, once', () => {
    const onOpenChange = vi.fn();
    mount({ onOpenChange });
    act(() => (dialog().querySelector('[aria-label="Close"]') as HTMLButtonElement).click());
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    key('Escape');
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it('Escape is left to a popover open inside it', () => {
    const onOpenChange = vi.fn();
    mount({ onOpenChange }, <div><button id="first">x</button><div data-boogy="popover" /></div>);
    key('Escape');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('a press outside it, on the page behind, closes it, scrim or none; a press inside never does', () => {
    const onOpenChange = vi.fn();
    mount({ onOpenChange });
    act(() => dialog().click());
    expect(onOpenChange).not.toHaveBeenCalled();
    act(() => panel()!.click());
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    act(() => render(null, host!));
    mount({ onOpenChange, scrim: true });
    expect(panel()!.getAttribute('data-scrim')).toBe('true');
    act(() => dialog().click());
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    act(() => panel()!.click());
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it('focus moves to the body on open, and back to where it was on close', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    mount({});
    expect(document.activeElement?.id).toBe('first');
    act(() => render(null, host!));
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('Tab stays inside: from the last control to the first', () => {
    mount({ foot: <button id="ok">Done</button> });
    (document.getElementById('ok') as HTMLElement).focus();
    key('Tab');
    expect(dialog().contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close');
  });
});

describe('<SidePanel> filling the window (a narrow screen): Back closes it', () => {
  const realMatch = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => { window.matchMedia = realMatch; vi.restoreAllMocks(); });
  const goBack = () => new Promise<void>((resolve) => {
    window.addEventListener('popstate', () => resolve(), { once: true });
    history.back();
  });

  it('fills the window, and pushes a history entry the browser Back takes it away with', async () => {
    const before = history.length;
    const onOpenChange = vi.fn();
    mount({ onOpenChange });
    expect(panel()!.getAttribute('data-full')).toBe('true');
    expect(history.length).toBe(before + 1);
    await act(goBack);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closed any other way, it steps back, leaving no dead entry', () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => window.dispatchEvent(new PopStateEvent('popstate')));
    mount({});
    act(() => render(null, host!));
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('<SidePanel> docked: no history entry', () => {
  it('a wide screen pushes nothing', () => {
    const before = history.length;
    mount({});
    expect(panel()!.hasAttribute('data-full')).toBe(false);
    expect(history.length).toBe(before);
  });
});

describe('<SidePanel> opening', () => {
  it('moves focus in without scrolling: a scroll while it slides in reads as a bounce', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'focus');
    mount({});
    const into = spy.mock.calls.filter((c, i) => (spy.mock.contexts[i] as HTMLElement).id === 'first');
    expect(into.length).toBe(1);
    expect(into[0][0]).toEqual({ preventScroll: true });
    spy.mockRestore();
  });
});

describe('<SidePanel> contents wait for the slide-in', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
  const sliding = () => {
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      const cs = real(el);
      if ((el as HTMLElement).dataset?.slot !== 'panel') return cs;
      return new Proxy(cs, { get: (t, k) => (k === 'transitionDuration' ? '0.16s' : Reflect.get(t, k)) });
    });
  };
  const body = () => dialog().querySelector('[data-slot="body"]')!;

  it('while it slides in, its head and foot are there and its body is empty; when it has, the body comes in, fading', () => {
    sliding();
    mount({ foot: <button id="ok">Done</button> });
    expect(dialog().querySelector('[data-slot="head"]')).toBeTruthy();
    expect(document.getElementById('ok')).toBeTruthy();
    expect(body().childNodes.length).toBe(0);
    expect(panel()!.hasAttribute('data-ready')).toBe(false);
    act(() => { dialog().dispatchEvent(new Event('transitionend')); });
    expect(body().querySelector('#first')).toBeTruthy();
    expect(panel()!.hasAttribute('data-ready')).toBe(true);
    expect(document.activeElement?.id).toBe('first');
  });

  it('a slide-in that never reports its end still shows the body, just after it should have ended', () => {
    vi.useFakeTimers();
    sliding();
    mount({});
    expect(body().childNodes.length).toBe(0);
    act(() => { vi.advanceTimersByTime(400); });
    expect(body().querySelector('#first')).toBeTruthy();
  });

  it('with no slide-in (reduced motion), the body is there at once', () => {
    mount({});
    expect(body().querySelector('#first')).toBeTruthy();
    expect(panel()!.hasAttribute('data-ready')).toBe(true);
  });
});
