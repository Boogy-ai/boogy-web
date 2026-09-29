import { describe, it, expect, afterEach } from 'vitest';
import { render, type JSX } from 'preact';
import { act } from 'preact/test-utils';
import { Thumbnail } from './index';

afterEach(() => { document.body.innerHTML = ''; });
const mount = (el: JSX.Element) => { const r = document.createElement('div'); document.body.append(r); act(() => render(el, r)); return r; };

describe('<Thumbnail>', () => {
  it('shows the initials when there is no image', () => {
    const r = mount(<Thumbnail label="Squad Chats" />);
    const t = r.querySelector('[data-boogy="thumbnail"]')!;
    expect(t.textContent).toBe('SC');
    expect(t.getAttribute('data-image')).toBe('false');
    expect(t.getAttribute('role')).toBe('img');
    expect(t.getAttribute('aria-label')).toBe('Squad Chats');
  });
  it('shows the image when given one', () => {
    const r = mount(<Thumbnail label="Squad Chats" src="/icon.png" size="lg" />);
    expect(r.querySelector('img')!.getAttribute('src')).toBe('/icon.png');
    expect(r.querySelector('[data-boogy="thumbnail"]')!.getAttribute('data-size')).toBe('lg');
  });
  it('falls back to the placeholder when the image fails to load — never a broken image', () => {
    const r = mount(<Thumbnail label="Wallet" src="/missing.png" />);
    act(() => { r.querySelector('img')!.dispatchEvent(new Event('error')); });
    expect(r.querySelector('img')).toBeNull();
    expect(r.querySelector('[data-boogy="thumbnail"]')!.textContent).toBe('W');
  });
});

describe('<Thumbnail> beside its own name', () => {
  it('decorative: hidden from assistive tech, so the name is not read twice', () => {
    const r = mount(<Thumbnail label="Wallet" decorative />);
    const t = r.querySelector('[data-boogy="thumbnail"]')!;
    expect(t.getAttribute('aria-hidden')).toBe('true');
    expect(t.getAttribute('role')).toBeNull();
    expect(t.getAttribute('aria-label')).toBeNull();
    expect(t.textContent).toBe('W');
  });
});
