import { describe, it, expect, vi, afterEach } from 'vitest';
// Loaded as an app that uses this package has it loaded: its vnode hook turns
// `onChange` on a colour or range input into `input`, so the "commits nothing
// while dragging" tests below are only meaningful with it in place.
import 'preact/compat';
import { render } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { hexToHsv, hsvToHex } from '@boogy/web';
import { ColorPicker, Popover } from './index';
import type { ColorPickerProps } from './index';

afterEach(() => { document.body.replaceChildren(); });

// 14 swatches in two rows of 7.
const SWATCHES = Array.from({ length: 14 }, (_, i) => ({ id: `c${i}`, label: `Colour ${i}`, color: `var(--c${i})` }));

function mount(props: Partial<ColorPickerProps> = {}) {
  const onValueChange = vi.fn();
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(
    <ColorPicker label="Fill colour" swatches={SWATCHES} value="c3" onValueChange={onValueChange} columns={7} {...props} />,
    root,
  ));
  const q = <E extends Element = HTMLElement>(s: string) => root.querySelector<E & Element>(s);
  const swatches = () => [...root.querySelectorAll<HTMLButtonElement>('[data-slot="swatches"] > button[data-slot="swatch"]')];
  return { root, q, swatches, onValueChange };
}

/** Dispatch a key press on `el` and return the event, to read whether it was handled. */
const key = (el: Element, k: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  act(() => { el.dispatchEvent(e); });
  return e;
};
/** Dispatch a key's release on `el` and return the event. */
const keyUp = (el: Element, k: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true, ...init });
  act(() => { el.dispatchEvent(e); });
  return e;
};
/** A key held down: its first press, `repeats` auto-repeats, then its release. */
const hold = (el: Element, k: string, repeats: number, init: KeyboardEventInit = {}) => {
  key(el, k, init);
  for (let i = 0; i < repeats; i++) key(el, k, { ...init, repeat: true });
  return keyUp(el, k, init);
};
const focus = (el: HTMLElement) => act(() => el.focus());
/** Set an input's value as a person would, then fire `type` on it. */
const fire = (el: HTMLInputElement, type: 'input' | 'change', value: string) =>
  act(() => { el.value = value; el.dispatchEvent(new Event(type, { bubbles: true })); });

describe('<ColorPicker> grid', () => {
  it('is a group named by its label, holding one labelled button per swatch, in rows of `columns`', () => {
    const { q, swatches } = mount();
    const root = q('[data-boogy="color-picker"]')!;
    expect(root.getAttribute('role')).toBe('group');
    expect(root.getAttribute('aria-label')).toBe('Fill colour');
    const all = swatches();
    expect(all).toHaveLength(14);
    expect(all.map((b) => b.getAttribute('aria-label'))).toEqual(SWATCHES.map((s) => s.label));
    expect(all.map((b) => b.title)).toEqual(SWATCHES.map((s) => s.label));
    expect(all.every((b) => b.type === 'button')).toBe(true);
    expect(q('[data-slot="swatches"]')!.style.getPropertyValue('--color-picker-columns')).toBe('7');
  });

  it('the grid is a toolbar (so its arrow keys are announced), named "Swatches" unless named otherwise', () => {
    const { q } = mount();
    const grid = q('[data-slot="swatches"]')!;
    expect(grid.getAttribute('role')).toBe('toolbar');
    expect(grid.getAttribute('aria-label')).toBe('Swatches');
    const named = mount({ swatchesLabel: 'Presets' });
    expect(named.q('[data-slot="swatches"]')!.getAttribute('aria-label')).toBe('Presets');
  });

  it('each swatch is itself the chip: it carries its colour as --swatch-color and holds nothing', () => {
    const { swatches } = mount();
    const b = swatches()[5];
    expect(b.style.getPropertyValue('--swatch-color')).toBe('var(--c5)');
    expect(b.childElementCount).toBe(0);
  });

  it('columns default to 10', () => {
    const { q } = mount({ columns: undefined });
    expect(q('[data-slot="swatches"]')!.style.getPropertyValue('--color-picker-columns')).toBe('10');
  });

  it('the chosen swatch is pressed and is the only tab stop', () => {
    const { swatches } = mount();
    const all = swatches();
    expect(all.map((b) => b.getAttribute('aria-pressed'))).toEqual(all.map((_, i) => (i === 3 ? 'true' : 'false')));
    expect(all.filter((b) => b.tabIndex === 0)).toEqual([all[3]]);
  });

  it('with no swatch chosen, the first is the tab stop and none is pressed', () => {
    const { swatches } = mount({ value: '#3a7bd5' });
    const all = swatches();
    expect(all.filter((b) => b.tabIndex === 0)).toEqual([all[0]]);
    expect(all.some((b) => b.getAttribute('aria-pressed') === 'true')).toBe(false);
  });

  it('arrow keys move focus only: Right one on, Down a row, End to the last, Home to the first; nothing is chosen', () => {
    const { swatches, onValueChange } = mount({ value: 'c0' });
    const all = swatches();
    focus(all[0]);
    key(all[0], 'ArrowRight');
    expect(document.activeElement).toBe(swatches()[1]);
    key(swatches()[1], 'ArrowLeft');
    expect(document.activeElement).toBe(swatches()[0]);
    key(swatches()[0], 'ArrowDown');
    expect(document.activeElement).toBe(swatches()[7]);
    key(swatches()[7], 'ArrowUp');
    expect(document.activeElement).toBe(swatches()[0]);
    key(swatches()[0], 'End');
    expect(document.activeElement).toBe(swatches()[13]);
    key(swatches()[13], 'Home');
    expect(document.activeElement).toBe(swatches()[0]);
    expect(onValueChange).not.toHaveBeenCalled();
    // Still the one chosen before.
    expect(swatches()[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('the tab stop follows focus while it is in the grid, so Tab and Shift+Tab leave it; leaving returns it to the chosen swatch', () => {
    const { root, swatches } = mount({ value: 'c0' });
    const after = document.createElement('button');
    root.appendChild(after);
    focus(swatches()[0]);
    key(swatches()[0], 'ArrowRight');
    key(swatches()[1], 'ArrowRight');
    expect(swatches().filter((b) => b.tabIndex === 0)).toEqual([swatches()[2]]);
    focus(after);
    expect(swatches().filter((b) => b.tabIndex === 0)).toEqual([swatches()[0]]);
  });

  it('Enter chooses the focused swatch, once', () => {
    const { swatches, onValueChange } = mount({ value: 'c0' });
    focus(swatches()[0]);
    key(swatches()[0], 'ArrowRight');
    key(swatches()[1], 'Enter');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('c1');
  });

  it('Space chooses the focused swatch, once', () => {
    const { swatches, onValueChange } = mount({ value: 'c0' });
    focus(swatches()[4]);
    key(swatches()[4], ' ');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('c4');
  });

  it('a click chooses a swatch, once', () => {
    const { swatches, onValueChange } = mount();
    act(() => swatches()[9].click());
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('c9');
  });

  it('choosing the swatch already chosen changes nothing, so it calls nothing', () => {
    const { swatches, onValueChange } = mount();
    act(() => swatches()[3].click());
    focus(swatches()[3]);
    key(swatches()[3], 'Enter');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('every key the grid handles is marked handled, so a menu around it does not act on it too', () => {
    const { swatches } = mount({ value: 'c0' });
    focus(swatches()[0]);
    for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'End', 'Home', 'Enter', ' ']) {
      expect(key(document.activeElement!, k).defaultPrevented, k).toBe(true);
    }
    // ...and only those: Tab and typing are left to the page.
    expect(key(document.activeElement!, 'Tab').defaultPrevented).toBe(false);
    expect(key(document.activeElement!, 'a').defaultPrevented).toBe(false);
    // A key with a modifier is a shortcut, not the grid's.
    expect(key(document.activeElement!, 'ArrowRight', { altKey: true }).defaultPrevented).toBe(false);
  });

  it('Space\'s release is marked handled too, so no engine clicks the swatch a second time', () => {
    const { swatches } = mount({ value: 'c0' });
    focus(swatches()[2]);
    const up = new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true });
    act(() => { swatches()[2].dispatchEvent(up); });
    expect(up.defaultPrevented).toBe(true);
  });

  it('opened in a popover, focus enters on the chosen swatch', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    function Harness() {
      const ref = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button id="trigger" ref={ref} onClick={() => setOpen(true)}>Fill</button>
          <Popover triggerRef={ref} isOpen={open} onOpenChange={setOpen}>
            <ColorPicker label="Fill colour" swatches={SWATCHES} value="c5" onValueChange={() => {}} />
          </Popover>
        </div>
      );
    }
    act(() => render(<Harness />, root));
    act(() => root.querySelector<HTMLButtonElement>('#trigger')!.click());
    const chosen = root.querySelector('button[aria-label="Colour 5"]');
    expect(document.activeElement).toBe(chosen);
  });
});

describe('<ColorPicker> layout', () => {
  it('stacks the swatches, then the custom colour, then (with onOpacityChange) the transparency slider, as its sections', () => {
    const { root } = mount({ onOpacityChange: vi.fn() });
    const picker = root.querySelector('[data-boogy="color-picker"]')!;
    expect([...picker.children].map((e) => (e as HTMLElement).dataset.slot)).toEqual(['swatches', 'custom', 'opacity']);
  });

  it('without onOpacityChange, the swatches and the custom colour only', () => {
    const { root } = mount();
    const picker = root.querySelector('[data-boogy="color-picker"]')!;
    expect([...picker.children].map((e) => (e as HTMLElement).dataset.slot)).toEqual(['swatches', 'custom']);
  });

  it('the custom colour is a group named by customLabel (default "Custom colour"): the area, the hue strip, then a row of a preview and the hex field', () => {
    const { q } = mount();
    const custom = q('[data-slot="custom"]')!;
    expect(custom.getAttribute('role')).toBe('group');
    expect(custom.getAttribute('aria-label')).toBe('Custom colour');
    expect([...custom.children].map((e) => (e as HTMLElement).dataset.slot)).toEqual(['area', 'hue', 'hex-row']);
    expect([...q('[data-slot="hex-row"]')!.children].map((e) => (e as HTMLElement).dataset.slot)).toEqual(['preview', 'hex']);
    expect(q('[data-slot="preview"]')!.getAttribute('aria-hidden')).toBe('true');
    // No system colour input: the custom colour is the picker's own.
    expect(q('input[type="color"]')).toBeNull();
    expect(mount({ customLabel: 'Any colour' }).q('[data-slot="custom"]')!.getAttribute('aria-label')).toBe('Any colour');
  });
});

/** Give the area a size, as a layout engine would, at the page's origin. */
function sizeArea(area: HTMLElement, width = 200, height = 100) {
  area.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON() {} }) as DOMRect;
}
/** A pointer event as a mouse sends it: the primary button held through a
 *  press and its moves (`buttons` 1), released on `pointerup` (`buttons` 0). */
const pointer = (el: Element, type: string, x: number, y: number, buttons = type === 'pointerdown' || type === 'pointermove' ? 1 : 0) =>
  act(() => { el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, button: 0, buttons, isPrimary: true, bubbles: true, cancelable: true })); });

describe('<ColorPicker> custom colour: seeding', () => {
  const hex = (q: ReturnType<typeof mount>['q']) => q<HTMLInputElement>('[data-slot="hex"]')!;
  const hue = (q: ReturnType<typeof mount>['q']) => q<HTMLInputElement>('[data-slot="hue"]')!;

  it('a custom value seeds the area, the hue strip and the hex field', () => {
    const { q } = mount({ value: '#3a7bd5' });
    const { h, s, v } = hexToHsv('#3a7bd5');
    expect(hex(q).value).toBe('#3a7bd5');
    expect(hue(q).value).toBe(String(Math.round(h)));
    const area = q('[data-slot="area"]')!;
    expect(area.getAttribute('aria-valuenow')).toBe(String(Math.round(s)));
    expect(area.getAttribute('aria-valuetext')).toBe(`Saturation ${Math.round(s)}%, Brightness ${Math.round(v)}%`);
    const thumb = q('[data-slot="area-thumb"]')!;
    expect(parseFloat(thumb.style.left)).toBeCloseTo(s, 3);
    expect(parseFloat(thumb.style.top)).toBeCloseTo(100 - v, 3);
  });

  it('an uppercase custom value is shown, and matched, in lowercase', () => {
    const { q } = mount({ value: '#3A7BD5' });
    expect(hex(q).value).toBe('#3a7bd5');
    expect(q('[data-slot="custom"]')!.getAttribute('data-pressed')).toBe('true');
  });

  it('a chosen swatch seeds the custom colour from its colour', () => {
    const swatches = [{ id: 'a', label: 'A', color: '#3a7bd5' }, { id: 'b', label: 'B', color: 'rgb(240, 180, 90)' }];
    expect(hex(mount({ swatches, value: 'a' }).q).value).toBe('#3a7bd5');
    expect(hex(mount({ swatches, value: 'b' }).q).value).toBe('#f0b45a');
  });

  it('choosing another swatch re-seeds it', () => {
    const swatches = [{ id: 'a', label: 'A', color: '#3a7bd5' }, { id: 'b', label: 'B', color: '#f0b45a' }];
    const root = document.createElement('div');
    document.body.appendChild(root);
    const draw = (value: string) => act(() => render(<ColorPicker label="Fill" swatches={swatches} value={value} onValueChange={() => {}} />, root));
    draw('a');
    draw('b');
    expect(root.querySelector<HTMLInputElement>('[data-slot="hex"]')!.value).toBe('#f0b45a');
  });

  it('with neither (a swatch whose colour cannot be read here), a neutral grey', () => {
    const { q } = mount({ value: 'c3' });
    expect(hex(q).value).toBe('#808080');
  });

  it('the picker carries the shown colour and its pure hue, for the area, the preview and the slider to draw with', () => {
    const { q } = mount({ value: '#3a7bd5', onOpacityChange: vi.fn() });
    const picker = q('[data-boogy="color-picker"]')!;
    expect(picker.style.getPropertyValue('--color-picker-current')).toBe('#3a7bd5');
    expect(picker.style.getPropertyValue('--color-picker-hue')).toBe(hsvToHex({ h: hexToHsv('#3a7bd5').h, s: 100, v: 100 }));
  });

  it('while a swatch is chosen and its colour cannot be read, the colour drawn with is the swatch\'s own', () => {
    const { q } = mount({ value: 'c5', onOpacityChange: vi.fn() });
    expect(q('[data-boogy="color-picker"]')!.style.getPropertyValue('--color-picker-current')).toBe('var(--c5)');
  });

  it('a chosen custom colour reads as chosen: the custom group is pressed and described by "chosen"', () => {
    const { q } = mount({ value: '#3a7bd5' });
    const custom = q('[data-slot="custom"]')!;
    expect(custom.getAttribute('data-pressed')).toBe('true');
    expect(document.getElementById(custom.getAttribute('aria-describedby')!)!.textContent).toBe('chosen');
    const named = mount({ value: '#3a7bd5', chosenLabel: 'selected' });
    const c2 = named.q('[data-slot="custom"]')!;
    expect(document.getElementById(c2.getAttribute('aria-describedby')!)!.textContent).toBe('selected');
  });

  it('while a swatch is chosen, the custom group is neither pressed nor described', () => {
    const { q } = mount();
    expect(q('[data-slot="custom"]')!.hasAttribute('data-pressed')).toBe(false);
    expect(q('[data-slot="custom"]')!.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('<ColorPicker> custom colour: the area', () => {
  const area = (q: ReturnType<typeof mount>['q']) => q('[data-slot="area"]')!;

  it('is a focusable slider named by areaLabel (default "Saturation and brightness")', () => {
    const { q } = mount({ value: '#3a7bd5' });
    const a = area(q);
    expect(a.getAttribute('role')).toBe('slider');
    expect(a.tabIndex).toBe(0);
    expect(a.getAttribute('aria-label')).toBe('Saturation and brightness');
    expect(a.getAttribute('aria-valuemin')).toBe('0');
    expect(a.getAttribute('aria-valuemax')).toBe('100');
    const named = mount({ value: '#3a7bd5', areaLabel: 'Shade', saturationLabel: 'Sat', brightnessLabel: 'Bright' });
    expect(area(named.q).getAttribute('aria-label')).toBe('Shade');
    expect(area(named.q).getAttribute('aria-valuetext')).toMatch(/^Sat \d+%, Bright \d+%$/);
  });

  it('a pointer drag moves the thumb and the shown colour live, and commits ONCE, on release', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    const a = area(q);
    sizeArea(a);
    const h = Number(q<HTMLInputElement>('[data-slot="hue"]')!.value);
    pointer(a, 'pointerdown', 50, 25);
    expect(parseFloat(q('[data-slot="area-thumb"]')!.style.left)).toBeCloseTo(25, 3);
    expect(parseFloat(q('[data-slot="area-thumb"]')!.style.top)).toBeCloseTo(25, 3);
    pointer(a, 'pointermove', 100, 50);
    pointer(a, 'pointermove', 150, 60);
    expect(q<HTMLInputElement>('[data-slot="hex"]')!.value).toBe(hsvToHex({ h: hexToHsv('#3a7bd5').h, s: 75, v: 40 }));
    expect(onValueChange).not.toHaveBeenCalled();
    pointer(a, 'pointerup', 150, 60);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(hsvToHex({ h: hexToHsv('#3a7bd5').h, s: 75, v: 40 }));
    expect(Math.round(hexToHsv('#3a7bd5').h)).toBe(h);
    // A move after the release is no drag.
    pointer(a, 'pointermove', 10, 10);
    expect(q<HTMLInputElement>('[data-slot="hex"]')!.value).toBe(hsvToHex({ h: hexToHsv('#3a7bd5').h, s: 75, v: 40 }));
  });

  it('a press past the edge is held to the edge', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    const a = area(q);
    sizeArea(a);
    pointer(a, 'pointerdown', -40, 300);
    pointer(a, 'pointerup', -40, 300);
    expect(onValueChange).toHaveBeenCalledWith('#000000');
    expect(a.getAttribute('aria-valuetext')).toBe('Saturation 0%, Brightness 0%');
  });

  it('a cancelled drag commits nothing and shows the value again', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    const a = area(q);
    sizeArea(a);
    pointer(a, 'pointerdown', 10, 10);
    pointer(a, 'pointercancel', 10, 10);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(q<HTMLInputElement>('[data-slot="hex"]')!.value).toBe('#3a7bd5');
  });

  it('a drag that loses its pointer capture ends there: nothing is committed, the value shows again, and later moves move nothing', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    const a = area(q);
    sizeArea(a);
    pointer(a, 'pointerdown', 10, 10);
    pointer(a, 'pointermove', 30, 30);
    pointer(a, 'lostpointercapture', 30, 30);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(q<HTMLInputElement>('[data-slot="hex"]')!.value).toBe('#3a7bd5');
    pointer(a, 'pointermove', 120, 80);
    pointer(a, 'pointerup', 120, 80);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(q<HTMLInputElement>('[data-slot="hex"]')!.value).toBe('#3a7bd5');
  });

  it('a move with no button held (its release went unseen) ends the drag the same way', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    const a = area(q);
    sizeArea(a);
    pointer(a, 'pointerdown', 10, 10);
    pointer(a, 'pointermove', 50, 50, 0);
    pointer(a, 'pointerup', 50, 50);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(q<HTMLInputElement>('[data-slot="hex"]')!.value).toBe('#3a7bd5');
  });

  it('a press on the area focuses it, so the keys go on from there', () => {
    const { q } = mount({ value: '#3a7bd5' });
    const a = area(q);
    sizeArea(a);
    pointer(a, 'pointerdown', 10, 10);
    expect(document.activeElement).toBe(a);
  });

  it('a held arrow moves the shown colour on every press, auto-repeats included, and commits once, on release', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    const a = area(q);
    focus(a);
    const { h, s, v } = hexToHsv('#3a7bd5');
    hold(a, 'ArrowRight', 4);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(hsvToHex({ h, s: s + 5, v }));
  });

  it('nothing is committed while the key is down', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    const a = area(q);
    focus(a);
    key(a, 'ArrowUp');
    key(a, 'ArrowUp', { repeat: true });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(a.getAttribute('aria-valuetext')).toBe(`Saturation ${Math.round(hexToHsv('#3a7bd5').s)}%, Brightness ${Math.round(hexToHsv('#3a7bd5').v + 2)}%`);
  });

  it('Shift steps by ten; Up and Down move brightness', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    const a = area(q);
    focus(a);
    const { h, s, v } = hexToHsv('#3a7bd5');
    hold(a, 'ArrowDown', 0, { shiftKey: true });
    expect(onValueChange).toHaveBeenCalledWith(hsvToHex({ h, s, v: v - 10 }));
  });

  it('a key held when focus leaves commits what it showed, once', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    const a = area(q);
    focus(a);
    key(a, 'ArrowLeft');
    act(() => a.blur());
    expect(onValueChange).toHaveBeenCalledTimes(1);
    keyUp(a, 'ArrowLeft');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('a key that does not move it (already at the edge) commits nothing', () => {
    const { q, onValueChange } = mount({ value: '#000000' });
    const a = area(q);
    focus(a);
    hold(a, 'ArrowDown', 2);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('a move that ends on the chosen swatch\'s own colour commits nothing: the swatch stays chosen', () => {
    const swatches = [{ id: 'a', label: 'A', color: '#3a7bd5' }, { id: 'b', label: 'B', color: '#f0b45a' }];
    const { q, onValueChange } = mount({ swatches, value: 'a' });
    const a = area(q);
    focus(a);
    key(a, 'ArrowRight');
    key(a, 'ArrowLeft');
    keyUp(a, 'ArrowLeft');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('Home and End take saturation to its ends; Page Up and Page Down step brightness by ten; each commits once, on release', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    const a = area(q);
    focus(a);
    const { h, s, v } = hexToHsv('#3a7bd5');
    hold(a, 'PageUp', 1);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(hsvToHex({ h, s, v: Math.min(100, v + 20) }));
    hold(a, 'Home', 0);
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(a.getAttribute('aria-valuenow')).toBe('0');
    hold(a, 'End', 3);
    expect(onValueChange).toHaveBeenCalledTimes(3);
    expect(a.getAttribute('aria-valuenow')).toBe('100');
    hold(a, 'PageDown', 0);
    expect(onValueChange).toHaveBeenCalledTimes(4);
    expect(onValueChange).toHaveBeenLastCalledWith(hsvToHex({ h, s: 100, v: Math.min(100, v + 20) - 10 }));
  });

  it('Space does nothing on the area, but is marked handled, so it does not scroll the menu', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    const a = area(q);
    focus(a);
    expect(key(a, ' ').defaultPrevented).toBe(true);
    expect(keyUp(a, ' ').defaultPrevented).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('every key it handles, press and release, is marked handled; others are left to the page', () => {
    const { q } = mount({ value: '#3a7bd5' });
    const a = area(q);
    focus(a);
    for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']) {
      expect(key(a, k).defaultPrevented, k).toBe(true);
      expect(keyUp(a, k).defaultPrevented, k).toBe(true);
    }
    expect(key(a, 'Tab').defaultPrevented).toBe(false);
    expect(key(a, 'Enter').defaultPrevented).toBe(false);
    expect(key(a, 'ArrowRight', { altKey: true }).defaultPrevented).toBe(false);
  });
});

describe('<ColorPicker> custom colour: the hue strip', () => {
  const hue = (q: ReturnType<typeof mount>['q']) => q<HTMLInputElement>('[data-slot="hue"]')!;

  it('is a range of whole degrees, 0 to 359, named by hueLabel (default "Hue")', () => {
    const { q } = mount({ value: '#3a7bd5' });
    const el = hue(q);
    expect(el.type).toBe('range');
    expect([el.min, el.max, el.step]).toEqual(['0', '359', '1']);
    expect(el.getAttribute('aria-label')).toBe('Hue');
    expect(hue(mount({ hueLabel: 'Tone' }).q).getAttribute('aria-label')).toBe('Tone');
  });

  it('dragging it moves the shown colour and the area\'s hue live, and commits nothing', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    fire(hue(q), 'input', '100');
    const { s, v } = hexToHsv('#3a7bd5');
    expect(q<HTMLInputElement>('[data-slot="hex"]')!.value).toBe(hsvToHex({ h: 100, s, v }));
    expect(q('[data-boogy="color-picker"]')!.style.getPropertyValue('--color-picker-hue')).toBe(hsvToHex({ h: 100, s: 100, v: 100 }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('releasing it commits the colour, once', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    fire(hue(q), 'input', '100');
    fire(hue(q), 'change', '100');
    const { s, v } = hexToHsv('#3a7bd5');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(hsvToHex({ h: 100, s, v }));
  });

  it('a held arrow moves it on every press, auto-repeats included, and commits once, on release', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    const el = hue(q);
    focus(el);
    const { h, s, v } = hexToHsv('#3a7bd5');
    key(el, 'ArrowRight');
    key(el, 'ArrowRight', { repeat: true });
    key(el, 'ArrowRight', { repeat: true });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(el.value).toBe(String(Math.round(h + 3)));
    keyUp(el, 'ArrowRight');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(hsvToHex({ h: h + 3, s, v }));
  });

  it('every key it handles is marked handled, press and release', () => {
    const { q } = mount({ value: '#3a7bd5' });
    const el = hue(q);
    focus(el);
    for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']) {
      expect(key(el, k).defaultPrevented, k).toBe(true);
      expect(keyUp(el, k).defaultPrevented, k).toBe(true);
    }
    expect(key(el, 'Tab').defaultPrevented).toBe(false);
  });

  it('a grey keeps the hue it was given: committed and come back as the value, the strip does not jump to red', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const committed: string[] = [];
    const draw = (value: string) => act(() => render(
      <ColorPicker label="Fill" swatches={SWATCHES} value={value} onValueChange={(v) => committed.push(v)} />, root));
    draw('#3a7bd5');
    const a = root.querySelector<HTMLElement>('[data-slot="area"]')!;
    sizeArea(a);
    const strip = root.querySelector<HTMLInputElement>('[data-slot="hue"]')!;
    const before = strip.value;
    // To the left edge: no saturation, a grey.
    pointer(a, 'pointerdown', 0, 50);
    pointer(a, 'pointerup', 0, 50);
    expect(committed).toHaveLength(1);
    expect(hexToHsv(committed[0]).s).toBe(0);
    draw(committed[0]);
    expect(strip.value).toBe(before);
    // ...and black keeps the saturation too.
    pointer(a, 'pointerdown', 120, 100);
    pointer(a, 'pointerup', 120, 100);
    expect(committed[1]).toBe('#000000');
    draw('#000000');
    expect(strip.value).toBe(before);
    expect(a.getAttribute('aria-valuenow')).toBe('60');
  });
});

describe('<ColorPicker> custom colour: the hex field', () => {
  const hex = (q: ReturnType<typeof mount>['q']) => q<HTMLInputElement>('[data-slot="hex"]')!;
  const type = (el: HTMLInputElement, text: string) => fire(el, 'input', text);

  it('is a text field named by hexLabel (default "Hex"), with no autocompletion', () => {
    const { q } = mount({ value: '#3a7bd5' });
    const el = hex(q);
    expect(el.type).toBe('text');
    expect(el.getAttribute('aria-label')).toBe('Hex');
    expect(el.getAttribute('autocomplete')).toBe('off');
    expect(hex(mount({ hexLabel: 'Code' }).q).getAttribute('aria-label')).toBe('Code');
  });

  it('typing commits nothing; Enter commits the colour, lowercased, once, and is marked handled', () => {
    const { q, onValueChange } = mount();
    const el = hex(q);
    focus(el);
    type(el, '#00FF88');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(key(el, 'Enter').defaultPrevented).toBe(true);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('#00ff88');
    act(() => el.blur());
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('leaving the field commits a well-formed colour', () => {
    const { q, onValueChange } = mount();
    const el = hex(q);
    focus(el);
    type(el, '#00ff88');
    act(() => el.blur());
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('#00ff88');
  });

  it('a colour typed without its # is taken too', () => {
    const { q, onValueChange } = mount();
    const el = hex(q);
    focus(el);
    type(el, ' 00ff88 ');
    key(el, 'Enter');
    expect(onValueChange).toHaveBeenCalledWith('#00ff88');
  });

  it('a malformed colour commits nothing and marks the field invalid, until it is fixed', () => {
    const { q, onValueChange } = mount();
    const el = hex(q);
    focus(el);
    type(el, '#00ff8');
    key(el, 'Enter');
    act(() => el.blur());
    expect(onValueChange).not.toHaveBeenCalled();
    expect(el.getAttribute('aria-invalid')).toBe('true');
    expect(el.value).toBe('#00ff8');
    focus(el);
    type(el, '#00ff88');
    expect(el.hasAttribute('aria-invalid')).toBe(false);
    key(el, 'Enter');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('a chosen swatch\'s own colour typed back (a character typed, then deleted) commits nothing: the swatch stays chosen', () => {
    const swatches = [{ id: 'a', label: 'A', color: '#3a7bd5' }, { id: 'b', label: 'B', color: '#f0b45a' }];
    const { q, onValueChange } = mount({ swatches, value: 'a' });
    const el = hex(q);
    focus(el);
    type(el, '#3a7bd5f');
    type(el, '#3a7bd5');
    act(() => el.blur());
    expect(onValueChange).not.toHaveBeenCalled();
    focus(el);
    type(el, '#3A7BD5');
    key(el, 'Enter');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('a committed colour moves the area and the hue strip to it', () => {
    const { q } = mount();
    const el = hex(q);
    focus(el);
    type(el, '#3a7bd5');
    key(el, 'Enter');
    const { h, s } = hexToHsv('#3a7bd5');
    expect(q<HTMLInputElement>('[data-slot="hue"]')!.value).toBe(String(Math.round(h)));
    expect(q('[data-slot="area"]')!.getAttribute('aria-valuenow')).toBe(String(Math.round(s)));
  });

  it('the colour already chosen commits nothing', () => {
    const { q, onValueChange } = mount({ value: '#3a7bd5' });
    const el = hex(q);
    focus(el);
    type(el, '#3A7BD5');
    key(el, 'Enter');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('the field follows the shown colour: a drag on the area writes over what was typed', () => {
    const { q } = mount({ value: '#3a7bd5' });
    const el = hex(q);
    type(el, '#00ff8');
    const a = q('[data-slot="area"]')!;
    sizeArea(a);
    pointer(a, 'pointerdown', 200, 0);
    expect(el.value).toBe(hsvToHex({ h: hexToHsv('#3a7bd5').h, s: 100, v: 100 }));
    expect(el.hasAttribute('aria-invalid')).toBe(false);
  });
});

describe('<ColorPicker> transparency slider', () => {
  const slider = (q: ReturnType<typeof mount>['q']) => q<HTMLInputElement>('[data-slot="opacity"] input[type="range"]')!;
  const shown = (q: ReturnType<typeof mount>['q']) => q('[data-slot="opacity"] label')!.textContent;

  it('is absent without onOpacityChange', () => {
    const { q } = mount({ opacity: 33 });
    expect(q('[data-slot="opacity"]')).toBeNull();
    expect(q('[data-slot="opacity"] input')).toBeNull();
  });

  it('shows transparency: opacity 33 reads 67, under a label (default "Transparency") with the percentage', () => {
    const { q } = mount({ opacity: 33, onOpacityChange: vi.fn() });
    const s = slider(q);
    expect(s.min).toBe('0');
    expect(s.max).toBe('100');
    expect(s.step).toBe('1');
    expect(s.value).toBe('67');
    expect(shown(q)).toContain('Transparency');
    expect(shown(q)).toContain('67%');
    expect(s.getAttribute('aria-valuetext')).toBe('67%');
    expect(q('[data-slot="opacity"] label')!.getAttribute('for')).toBe(s.id);
    // Named by the label's name alone: its percentage is the value, read as such.
    expect(document.getElementById(s.getAttribute('aria-labelledby')!)?.textContent).toBe('Transparency');
    const named = mount({ opacity: 33, onOpacityChange: vi.fn(), opacityLabel: 'See-through' });
    expect(shown(named.q)).toContain('See-through');
  });

  it('dragging updates the shown percentage live, and commits nothing', () => {
    const onOpacityChange = vi.fn();
    const { q } = mount({ opacity: 33, onOpacityChange });
    fire(slider(q), 'input', '20');
    expect(shown(q)).toContain('20%');
    expect(onOpacityChange).not.toHaveBeenCalled();
  });

  it('releasing commits the opacity, once', () => {
    const onOpacityChange = vi.fn();
    const { q } = mount({ opacity: 33, onOpacityChange });
    fire(slider(q), 'input', '20');
    fire(slider(q), 'change', '20');
    expect(onOpacityChange).toHaveBeenCalledTimes(1);
    expect(onOpacityChange).toHaveBeenCalledWith(80);
  });

  it('a held arrow moves the shown percentage on every press, auto-repeats included, and commits once, on release', () => {
    const onOpacityChange = vi.fn();
    const { q } = mount({ opacity: 33, onOpacityChange });
    const s = slider(q);
    focus(s);
    key(s, 'ArrowRight');
    key(s, 'ArrowRight', { repeat: true });
    key(s, 'ArrowRight', { repeat: true });
    expect(onOpacityChange).not.toHaveBeenCalled();
    expect(shown(q)).toContain('70%');
    expect(s.value).toBe('70');
    keyUp(s, 'ArrowRight');
    expect(onOpacityChange).toHaveBeenCalledTimes(1);
    expect(onOpacityChange).toHaveBeenCalledWith(30);
  });

  it('every key it handles is marked handled, press and release', () => {
    const { q } = mount({ opacity: 33, onOpacityChange: vi.fn() });
    const s = slider(q);
    focus(s);
    for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']) {
      expect(key(s, k).defaultPrevented, k).toBe(true);
      expect(keyUp(s, k).defaultPrevented, k).toBe(true);
    }
    expect(key(s, 'Tab').defaultPrevented).toBe(false);
  });

  it('a key held when focus leaves commits what it showed, once', () => {
    const onOpacityChange = vi.fn();
    const { q } = mount({ opacity: 33, onOpacityChange });
    const s = slider(q);
    focus(s);
    key(s, 'ArrowLeft');
    act(() => s.blur());
    expect(onOpacityChange).toHaveBeenCalledTimes(1);
    expect(onOpacityChange).toHaveBeenCalledWith(34);
    keyUp(s, 'ArrowLeft');
    expect(onOpacityChange).toHaveBeenCalledTimes(1);
  });

  it('a key that would not move it commits nothing', () => {
    const onOpacityChange = vi.fn();
    const { q } = mount({ opacity: 0, onOpacityChange });
    focus(slider(q));
    hold(slider(q), 'End', 2);
    expect(onOpacityChange).not.toHaveBeenCalled();
  });

  it('a drag that ends where it began (no change event) leaves no stale value: a later opacity from outside shows', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const draw = (opacity: number) => act(() => render(
      <ColorPicker label="Fill" swatches={SWATCHES} value="c0" onValueChange={() => {}} opacity={opacity} onOpacityChange={() => {}} />, root));
    draw(33);
    const s = root.querySelector<HTMLInputElement>('[data-slot="opacity"] input')!;
    fire(s, 'input', '50');
    fire(s, 'input', '67');
    draw(90);
    expect(s.value).toBe('10');
    expect(root.querySelector('[data-slot="opacity"] label')!.textContent).toContain('10%');
  });

  it('the slider follows a new opacity from outside', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const draw = (opacity: number) => act(() => render(
      <ColorPicker label="Fill" swatches={SWATCHES} value="c0" onValueChange={() => {}} opacity={opacity} onOpacityChange={() => {}} />, root));
    draw(33);
    draw(90);
    expect(root.querySelector<HTMLInputElement>('[data-slot="opacity"] input')!.value).toBe('10');
    expect(root.querySelector('[data-slot="opacity"] label')!.textContent).toContain('10%');
  });
});
