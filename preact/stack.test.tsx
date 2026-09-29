import { describe, it, expect, afterEach } from 'vitest';
import { render, type JSX } from 'preact';
import { act } from 'preact/test-utils';
import { Stack } from './index';

afterEach(() => { document.body.innerHTML = ''; });
const mount = (el: JSX.Element) => { const r = document.createElement('div'); document.body.append(r); act(() => render(el, r)); return r; };

describe('<Stack>', () => {
  it('lays its children out with a gap, as the element it is told to be', () => {
    const r = mount(<Stack as="article" gap={3}><p id="a" /><p id="b" /></Stack>);
    const s = r.querySelector('article')!;
    expect(s.dataset.boogy).toBe('stack');
    expect(s.dataset.gap).toBe('3');
    expect(s.dataset.direction).toBe('column');
    expect(s.querySelectorAll('p').length).toBe(2);
  });
  it('a row is a div by default', () => {
    const r = mount(<Stack direction="row" gap={1}><span /></Stack>);
    expect(r.querySelector('div[data-boogy="stack"]')!.dataset.direction).toBe('row');
  });
});
