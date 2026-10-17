import { describe, it, expect, afterEach } from 'vitest';
import { render, type JSX } from 'preact';
import { act } from 'preact/test-utils';
import { NumericValue } from './index';

const mount = (el: JSX.Element) => { const r = document.createElement('div'); document.body.append(r); act(() => render(el, r)); return r; };
afterEach(() => { document.body.innerHTML = ''; });

describe('<NumericValue>', () => {
  it('a number, formatted, carrying its exact value', () => {
    const el = mount(<NumericValue value={4200} locale="en-US" />).querySelector('data')!;
    expect(el.getAttribute('data-boogy')).toBe('numeric-value');
    expect(el.getAttribute('value')).toBe('4200');
    expect(el.textContent).toBe('4,200');
    expect(el.hasAttribute('title')).toBe(false);
  });
  it('compact: abbreviated, with the exact value as its title', () => {
    const el = mount(<NumericValue value={4200} variant="compact" locale="en-US" />).querySelector('data')!;
    expect(el.textContent).toBe('4.2K');
    expect(el.getAttribute('data-variant')).toBe('compact');
    expect(el.getAttribute('title')).toBe('4,200');
  });
  it('passes decimals and trimZeros through', () => {
    expect(mount(<NumericValue value={4} decimals={2} locale="en-US" />).textContent).toBe('4.00');
    expect(mount(<NumericValue value={4} decimals={2} trimZeros locale="en-US" />).textContent).toBe('4');
  });
});
