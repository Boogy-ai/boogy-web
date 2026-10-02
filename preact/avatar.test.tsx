import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { Avatar, SeededArt } from './index';

afterEach(() => { document.body.replaceChildren(); });
const mount = (el: preact.ComponentChild) => { const r = document.createElement('div'); document.body.append(r); act(() => render(el, r)); return r; };
const firstStop = (r: Element) => r.querySelector('[data-boogy="seeded-art"] stop')!.getAttribute('stop-color');

describe('<Avatar>', () => {
  it("with no picture: the person's initials over art seeded from them, named for assistive tech", () => {
    const r = mount(<Avatar name="Ada Lovelace" />);
    const a = r.querySelector('[data-boogy="avatar"]')!;
    expect(a.getAttribute('data-variant')).toBe('circle');
    expect(a.getAttribute('role')).toBe('img');
    expect(a.getAttribute('aria-label')).toBe('Ada Lovelace');
    expect(a.querySelector('[data-boogy="seeded-art"]')).not.toBeNull();
    expect(a.querySelector('[data-slot="initials"]')!.textContent).toBe('AL');
  });
  it('the art follows the seed (the name unless one is given), so a rename can keep the colours', () => {
    const byName = firstStop(mount(<Avatar name="carol" />));
    expect(firstStop(mount(<Avatar name="carol" />))).toBe(byName);
    expect(firstStop(mount(<Avatar name="Carol D." seed="carol" />))).toBe(byName);
    expect(firstStop(mount(<Avatar name="carol" seed="boogy://carol/services/squad" />))).not.toBe(byName);
  });
  it('a picture replaces the art; if it fails to load, the art comes back', () => {
    const r = mount(<Avatar name="ada" src="/ada.png" variant="rounded" size="lg" />);
    const a = r.querySelector('[data-boogy="avatar"]')!;
    expect(a.getAttribute('data-variant')).toBe('rounded');
    expect(a.querySelector('img')!.getAttribute('src')).toBe('/ada.png');
    expect(a.querySelector('[data-boogy="seeded-art"]')).toBeNull();
    act(() => { a.querySelector('img')!.dispatchEvent(new Event('error')); });
    expect(a.querySelector('img')).toBeNull();
    expect(a.querySelector('[data-boogy="seeded-art"]')).not.toBeNull();
  });
  it('decorative: hidden from assistive tech, for an avatar beside its own name', () => {
    const a = mount(<Avatar name="ada" decorative />).querySelector('[data-boogy="avatar"]')!;
    expect(a.getAttribute('aria-hidden')).toBe('true');
    expect(a.hasAttribute('role')).toBe(false);
  });
});

describe('<SeededArt>', () => {
  it('decorative SVG whose gradient ids are unique on the page', () => {
    const r = mount(<div><SeededArt seed="x" /><SeededArt seed="x" /></div>);
    const svgs = r.querySelectorAll('svg[data-boogy="seeded-art"]');
    expect(svgs.length).toBe(2);
    expect(svgs[0].getAttribute('aria-hidden')).toBe('true');
    const ids = [...r.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
