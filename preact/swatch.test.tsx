import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { Swatch } from './index';

afterEach(() => { document.body.replaceChildren(); });

describe('<Swatch>', () => {
  it('is a hidden span carrying its colour as --swatch-color, passing attributes through', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    act(() => render(<Swatch color="var(--brand)" data-slot="icon" data-tone="x" />, root));
    const el = root.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('SPAN');
    expect(el.dataset.boogy).toBe('swatch');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.style.getPropertyValue('--swatch-color')).toBe('var(--brand)');
    expect(el.dataset.slot).toBe('icon');
    expect(el.dataset.tone).toBe('x');
  });
});
