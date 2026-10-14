import { describe, it, expect, vi, afterEach } from 'vitest';
// Loaded as an app that uses this package has it loaded: its vnode hook turns
// `onChange` on a range input into `input`, so "commits nothing while
// dragging" is only meaningful with it in place.
import 'preact/compat';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { Slider } from './index';
import type { SliderProps } from './index';

afterEach(() => { document.body.replaceChildren(); });

function mount(props: Partial<SliderProps> = {}) {
  const onValueChange = vi.fn();
  const onValueInput = vi.fn();
  const root = document.createElement('div');
  document.body.appendChild(root);
  const all: SliderProps = { label: 'Hue', value: 0, min: -180, max: 180, onValueChange, onValueInput, ...props };
  const draw = (over: Partial<SliderProps> = {}) => act(() => render(<Slider {...all} {...over} />, root));
  draw();
  const input = () => root.querySelector<HTMLInputElement>('[data-boogy="slider"] > [data-slot="input"]')!;
  const shown = () => root.querySelector('[data-boogy="slider"] [data-slot="value"]')!.textContent;
  return { root, input, shown, draw, onValueChange: all.onValueChange as ReturnType<typeof vi.fn>, onValueInput: all.onValueInput as ReturnType<typeof vi.fn> };
}
const key = (el: Element, k: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  act(() => { el.dispatchEvent(e); });
  return e;
};
const keyUp = (el: Element, k: string) => {
  const e = new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true });
  act(() => { el.dispatchEvent(e); });
  return e;
};
const fire = (el: HTMLInputElement, type: 'input' | 'change', value: string) =>
  act(() => { el.value = value; el.dispatchEvent(new Event(type, { bubbles: true })); });

describe('<Slider>', () => {
  it('is a range input in its range, labelled, its value shown and spoken as `format` words it', () => {
    const { root, input, shown } = mount({ value: 40, step: 5, format: (v) => `${v > 0 ? '+' : ''}${v}°` });
    const s = input();
    expect(s.type).toBe('range');
    expect([s.min, s.max, s.step, s.value]).toEqual(['-180', '180', '5', '40']);
    expect(shown()).toBe('+40°');
    expect(s.getAttribute('aria-valuetext')).toBe('+40°');
    const label = root.querySelector('[data-boogy="slider"] > label')!;
    expect(label.getAttribute('for')).toBe(s.id);
    // Named by its label alone: the shown value is its value, read as such.
    expect(document.getElementById(s.getAttribute('aria-labelledby')!)?.textContent).toBe('Hue');
  });

  it('defaults to 0 to 100 in steps of one, the value shown as a number', () => {
    const { input, shown } = mount({ min: undefined, max: undefined, value: 30 });
    expect([input().min, input().max, input().step]).toEqual(['0', '100', '1']);
    expect(shown()).toBe('30');
  });

  it('dragging shows each step and reports it to onValueInput, committing nothing', () => {
    const { input, shown, onValueInput, onValueChange } = mount();
    fire(input(), 'input', '20');
    fire(input(), 'input', '25');
    expect(shown()).toBe('25');
    expect(onValueInput.mock.calls).toEqual([[20], [25]]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('releasing commits the value, once', () => {
    const { input, onValueChange } = mount();
    fire(input(), 'input', '20');
    fire(input(), 'change', '20');
    expect(onValueChange.mock.calls).toEqual([[20]]);
  });

  it('a held arrow moves it on every press and commits once, on release; every key it handles is marked handled', () => {
    const { input, shown, onValueInput, onValueChange } = mount({ value: 10 });
    const s = input();
    act(() => s.focus());
    expect(key(s, 'ArrowRight').defaultPrevented).toBe(true);
    key(s, 'ArrowRight', { repeat: true });
    expect(shown()).toBe('12');
    expect(onValueInput.mock.calls).toEqual([[11], [12]]);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(keyUp(s, 'ArrowRight').defaultPrevented).toBe(true);
    expect(onValueChange.mock.calls).toEqual([[12]]);
    expect(key(s, 'Tab').defaultPrevented).toBe(false);
  });

  it('focus leaving with a key held commits what it showed, once', () => {
    const { input, onValueChange } = mount({ value: 10 });
    const s = input();
    act(() => s.focus());
    key(s, 'ArrowLeft');
    act(() => s.blur());
    keyUp(s, 'ArrowLeft');
    expect(onValueChange.mock.calls).toEqual([[9]]);
  });

  it('a move that ends where it began commits nothing, and a later value from outside shows', () => {
    const { input, shown, draw, onValueChange } = mount({ value: 180 });
    act(() => input().focus());
    key(input(), 'End');
    keyUp(input(), 'End');
    expect(onValueChange).not.toHaveBeenCalled();
    fire(input(), 'input', '30'); // dragged away and back, with no change event to end it
    fire(input(), 'input', '180');
    draw({ value: -90 });
    expect(shown()).toBe('-90');
    expect(input().value).toBe('-90');
  });

  it('commits against where the move began, so a value that follows the drag (a live preview) still commits', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const onValueChange = vi.fn();
    let value = 0;
    const draw = () => act(() => render(
      <Slider label="Hue" value={value} min={-180} max={180} onValueChange={onValueChange}
              onValueInput={(v) => { value = v; draw(); }} />, root));
    draw();
    const s = root.querySelector<HTMLInputElement>('[data-slot="input"]')!;
    fire(s, 'input', '30');
    fire(s, 'input', '40');
    fire(s, 'change', '40');
    expect(onValueChange.mock.calls).toEqual([[40]]);
    act(() => s.focus());
    key(s, 'ArrowRight');
    key(s, 'ArrowRight', { repeat: true });
    keyUp(s, 'ArrowRight');
    expect(onValueChange.mock.calls).toEqual([[40], [42]]);
    // Back where it began: nothing to commit.
    fire(s, 'input', '10');
    fire(s, 'input', '42');
    fire(s, 'change', '42');
    expect(onValueChange.mock.calls).toEqual([[40], [42]]);
  });

  it('passes its own attributes to the group, data-slot included', () => {
    const { root } = mount({ 'data-slot': 'opacity', class: 'mine' } as Partial<SliderProps>);
    const el = root.querySelector('[data-boogy="slider"]')!;
    expect(el.getAttribute('data-slot')).toBe('opacity');
    expect(el.classList.contains('mine')).toBe(true);
  });
});

describe('<Slider> paint', () => {
  const mountPaint = (props: Record<string, string>) => {
    const host = document.createElement('div');
    act(() => render(<Slider label="Hue" value={10} onValueChange={() => {}} {...props} />, host));
    return host.firstElementChild as HTMLElement;
  };
  it('track: painted on the track, through --slider-paint', () => {
    const el = mountPaint({ track: 'linear-gradient(red, blue)' });
    expect(el.style.getPropertyValue('--slider-paint')).toBe('linear-gradient(red, blue)');
  });
  it('thumb: its colour through --slider-thumb, and the input marked to ring it', () => {
    const el = mountPaint({ thumb: '#123456' });
    expect(el.style.getPropertyValue('--slider-thumb')).toBe('#123456');
    expect(el.querySelector('input')!.hasAttribute('data-thumb')).toBe(true);
  });
  it('neither: nothing set, as before', () => {
    const el = mountPaint({});
    expect(el.style.getPropertyValue('--slider-paint')).toBe('');
    expect(el.style.getPropertyValue('--slider-thumb')).toBe('');
    expect(el.querySelector('input')!.hasAttribute('data-thumb')).toBe(false);
  });
});
