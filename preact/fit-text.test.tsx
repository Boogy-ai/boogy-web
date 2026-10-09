import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { FitText } from './index';
import { flushRounds, setFrameScheduler } from '../src/components/measure';

let restore: (run: () => void) => void;
beforeEach(() => { restore = setFrameScheduler(() => {}); });
afterEach(() => { setFrameScheduler(restore); document.body.replaceChildren(); });

describe('<FitText>', () => {
  it('renders its tag with the bounds as custom properties, then sets the fitted factor', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    act(() => render(<FitText as="h1" min="1rem" max="4rem" data-slot="q">Hello</FitText>, root));
    const el = root.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('H1');
    expect(el.dataset.boogy).toBe('fit-text');
    expect(el.dataset.slot).toBe('q');
    expect(el.style.getPropertyValue('--fit-min')).toBe('1rem');
    expect(el.style.getPropertyValue('--fit-max')).toBe('4rem');
    flushRounds();
    // happy-dom lays nothing out, so the text "fits" at the maximum.
    expect(el.style.getPropertyValue('--fit')).toBe('1');
  });

  it('texts given one group are fitted at one size, and the group is not an attribute', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    act(() => render(<><FitText min="1rem" max="4rem" group="labels">Short</FitText><FitText min="1rem" max="4rem" group="labels">A longer one</FitText></>, root));
    const [a, b] = [...root.children] as HTMLElement[];
    // happy-dom lays nothing out: each text "fits" up to its own factor.
    const layout = (el: HTMLElement, upTo: number) => {
      const f = () => Number.parseFloat(el.style.getPropertyValue('--fit') || '1');
      Object.defineProperty(el, 'clientHeight', { get: () => 40 });
      Object.defineProperty(el, 'scrollHeight', { get: () => (f() <= upTo ? 40 : 120) });
    };
    layout(a, 0.8);
    layout(b, 0.4);
    flushRounds();
    expect(a.style.getPropertyValue('--fit')).toBe(b.style.getPropertyValue('--fit'));
    expect(Number.parseFloat(b.style.getPropertyValue('--fit'))).toBeLessThanOrEqual(0.4);
    expect(a.hasAttribute('group')).toBe(false);
  });

  it('a changed tag is a new element, and that element is the one fitted', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    act(() => render(<FitText as="h1" min="1rem" max="4rem">Hello</FitText>, root));
    flushRounds();
    act(() => render(<FitText as="h2" min="1rem" max="4rem">Hello</FitText>, root));
    const el = root.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('H2');
    flushRounds();
    expect(el.style.getPropertyValue('--fit')).toBe('1');
  });
});
