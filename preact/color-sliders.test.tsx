import { describe, it, expect, vi, afterEach } from 'vitest';
import 'preact/compat';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { ColorSliders } from './index';
import { hexToSliders } from '@boogy/web';

let host: HTMLElement | null = null;
function mount(node: preact.ComponentChild) {
  host ??= document.createElement('div');
  act(() => render(node, host!));
  return host;
}
afterEach(() => { if (host) act(() => render(null, host!)); host = null; });
const inputs = () => [...host!.querySelectorAll('input[type="range"]')] as HTMLInputElement[];
const labels = () => [...host!.querySelectorAll('[data-slot="label"]')].map((l) => l.textContent);
function slide(el: HTMLInputElement, to: number) {
  act(() => { el.value = String(to); el.dispatchEvent(new Event('input', { bubbles: true })); });
}
function release(el: HTMLInputElement) {
  act(() => { el.dispatchEvent(new Event('change', { bubbles: true })); });
}

describe('<ColorSliders>', () => {
  it('three named sliders, Lightness over the range it is given', () => {
    mount(<ColorSliders value="#232f47" onValueChange={() => {}} lightness={{ min: 0.14, max: 0.4 }} />);
    expect(host!.firstElementChild!.getAttribute('data-boogy')).toBe('color-sliders');
    expect(labels()).toEqual(['Hue', 'Saturation', 'Lightness']);
    const [, , l] = inputs();
    expect(l.min).toBe('14');
    expect(l.max).toBe('40');
    expect(Number(l.value)).toBe(hexToSliders('#232f47').l);
  });

  it('labels can be renamed', () => {
    mount(<ColorSliders value="#232f47" onValueChange={() => {}} hueLabel="Teinte" saturationLabel="Saturation" lightnessLabel="Luminosité" />);
    expect(labels()).toEqual(['Teinte', 'Saturation', 'Luminosité']);
  });

  it('a drag previews a colour on every step and commits once, on release', () => {
    const onValueInput = vi.fn();
    const onValueChange = vi.fn();
    mount(<ColorSliders value="#232f47" onValueChange={onValueChange} onValueInput={onValueInput} />);
    const [h] = inputs();
    slide(h, 10);
    slide(h, 20);
    expect(onValueInput).toHaveBeenCalledTimes(2);
    expect(onValueInput.mock.calls[1][0]).toMatch(/^#[0-9a-f]{6}$/);
    expect(onValueChange).not.toHaveBeenCalled();
    release(h);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(hexToSliders(onValueChange.mock.calls[0][0]).h).toBeGreaterThanOrEqual(18);
  });

  it('Saturation to nothing, then Hue: the hue stays where it was moved', () => {
    let value = '#232f47';
    const onValueInput = vi.fn((v: string) => { value = v; });
    const view = () => <ColorSliders value={value} onValueChange={(v) => { value = v; }} onValueInput={onValueInput} />;
    mount(view());
    const [h, s] = inputs();
    slide(s, 0); release(s); mount(view());
    slide(h, 120); release(h); mount(view());
    expect(Number(inputs()[0].value)).toBe(120);
  });

  it('a new value from outside is read into the sliders', () => {
    mount(<ColorSliders value="#232f47" onValueChange={() => {}} />);
    mount(<ColorSliders value="#3e2a2e" onValueChange={() => {}} />);
    expect(Number(inputs()[0].value)).toBe(hexToSliders('#3e2a2e').h);
  });

  it('each track paints what its slider changes; each thumb is the colour', () => {
    mount(<ColorSliders value="#232f47" onValueChange={() => {}} />);
    const sliders = [...host!.querySelectorAll('[data-boogy="slider"]')] as HTMLElement[];
    for (const el of sliders) {
      expect(el.style.getPropertyValue('--slider-paint')).toMatch(/^linear-gradient/);
      expect(el.style.getPropertyValue('--slider-thumb')).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
