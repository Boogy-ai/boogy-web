import { describe, it, expect, afterEach } from 'vitest';
import { render, type JSX } from 'preact';
import { act } from 'preact/test-utils';
import { TagList } from './index';

afterEach(() => { document.body.innerHTML = ''; });
const mount = (el: JSX.Element) => { const r = document.createElement('div'); document.body.append(r); act(() => render(el, r)); return r; };
const pills = (r: Element) => [...r.querySelectorAll('[data-boogy="pill"]')].map((p) => p.textContent);

describe('<TagList>', () => {
  it('is a wrapping row of pills', () => {
    const r = mount(<TagList tags={['chat', 'rooms']} />);
    expect(r.querySelector('[data-boogy="stack"]')!.getAttribute('data-direction')).toBe('row');
    expect(pills(r)).toEqual(['chat', 'rooms']);
  });
  it('shows at most `max`, then says how many more', () => {
    const r = mount(<TagList tags={['a1', 'b2', 'c3', 'd4', 'e5']} max={3} />);
    expect(pills(r)).toEqual(['a1', 'b2', 'c3', '+2']);
  });
  it('renders nothing when there are no tags', () => {
    const r = mount(<TagList tags={[]} />);
    expect(r.innerHTML).toBe('');
  });
});
