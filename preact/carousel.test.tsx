import { describe, it, expect, afterEach } from 'vitest';
import { render, type JSX } from 'preact';
import { act } from 'preact/test-utils';
import { Card, Carousel } from './index';

afterEach(() => { document.body.innerHTML = ''; });
const mount = (el: JSX.Element) => { const r = document.createElement('div'); document.body.append(r); act(() => render(el, r)); return r; };
const three = [{ src: '/a.webp' }, { src: '/b.webp' }, { src: '/c.webp' }];
const src = (r: HTMLElement) => r.querySelector('[data-boogy="carousel"] > img')!.getAttribute('src');
const click = (el: Element) => act(() => { (el as HTMLElement).click(); });

describe('<Carousel>', () => {
  it('with no images, its fallback fills the same frame — and there is no pager', () => {
    const r = mount(<Carousel label="Wordle" images={[]} fallback={<p id="fb">none</p>} />);
    const frame = r.querySelector('[data-boogy="carousel"]')!;
    expect(frame.querySelector('[data-slot="fallback"] #fb')).not.toBeNull();
    expect(frame.querySelector('img')).toBeNull();
    expect(frame.querySelector('[data-slot="dots"]')).toBeNull();
  });
  it('with no images and no fallback renders nothing', () => {
    const r = mount(<Carousel label="Wordle" images={[]} />);
    expect(r.innerHTML).toBe('');
  });

  it('with one image shows it and no pager', () => {
    const r = mount(<Carousel label="Wordle" images={[{ src: '/a.webp' }]} />);
    expect(src(r)).toBe('/a.webp');
    expect(r.querySelector('[data-slot="prev"]')).toBeNull();
    expect(r.querySelector('[data-slot="dots"]')).toBeNull();
    expect(r.querySelector('[data-boogy="carousel"]')!.getAttribute('data-paged')).toBe('false');
  });

  it('with several, pages forward and back and wraps round', () => {
    const r = mount(<Carousel label="Wordle" images={three} />);
    expect(src(r)).toBe('/a.webp');
    click(r.querySelector('[data-slot="next"]')!);
    expect(src(r)).toBe('/b.webp');
    click(r.querySelector('[data-slot="prev"]')!);
    click(r.querySelector('[data-slot="prev"]')!);
    expect(src(r)).toBe('/c.webp');
    click(r.querySelector('[data-slot="next"]')!);
    expect(src(r)).toBe('/a.webp');
  });

  it('has one named dot per image, the current one marked, and a dot jumps to its image', () => {
    const r = mount(<Carousel label="Wordle" images={three} />);
    const dots = () => [...r.querySelectorAll('[data-slot="dots"] > button')];
    expect(dots().map((d) => d.getAttribute('aria-label'))).toEqual(['Image 1 of 3', 'Image 2 of 3', 'Image 3 of 3']);
    expect(dots().map((d) => d.getAttribute('aria-current'))).toEqual(['true', null, null]);
    click(dots()[2]!);
    expect(src(r)).toBe('/c.webp');
    expect(dots()[2]!.getAttribute('aria-current')).toBe('true');
  });

  it('names its controls, and is a labelled carousel group', () => {
    const r = mount(<Carousel label="Wordle" images={three} />);
    const root = r.querySelector('[data-boogy="carousel"]')!;
    expect(root.getAttribute('role')).toBe('group');
    expect(root.getAttribute('aria-roledescription')).toBe('carousel');
    expect(root.getAttribute('aria-label')).toBe('Wordle');
    expect(r.querySelector('[data-slot="prev"]')!.getAttribute('aria-label')).toBe('Previous image');
    expect(r.querySelector('[data-slot="next"]')!.getAttribute('aria-label')).toBe('Next image');
  });

  it('pages with the arrow keys', () => {
    const r = mount(<Carousel label="Wordle" images={three} />);
    const root = r.querySelector('[data-boogy="carousel"]')!;
    act(() => { root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    expect(src(r)).toBe('/b.webp');
    act(() => { root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); });
    expect(src(r)).toBe('/a.webp');
  });

  it('drops an image that fails to load — never a broken image — and loses the pager at one left', () => {
    const r = mount(<Carousel label="Wordle" images={[{ src: '/bad.webp' }, { src: '/b.webp' }]} />);
    act(() => { r.querySelector('img')!.dispatchEvent(new Event('error')); });
    expect(src(r)).toBe('/b.webp');
    expect(r.querySelector('[data-slot="dots"]')).toBeNull();
  });

  it('shows the fallback in the frame once every image has failed', () => {
    const r = mount(<Carousel label="Wordle" images={[{ src: '/bad.webp' }]} fallback={<p id="fb">none</p>} />);
    act(() => { r.querySelector('img')!.dispatchEvent(new Event('error')); });
    expect(r.querySelector('img')).toBeNull();
    expect(r.querySelector('[data-boogy="carousel"] [data-slot="fallback"] #fb')).not.toBeNull();
  });
});

describe('<Card> cover', () => {
  it('puts the cover first, above the head', () => {
    const r = mount(<Card cover={<Carousel label="Boards" images={[{ src: '/a.webp' }]} />} title="Boards" />);
    const article = r.querySelector('[data-boogy="card"]')!;
    expect(article.firstElementChild!.getAttribute('data-slot')).toBe('cover');
    expect(article.children[1]!.getAttribute('data-slot')).toBe('head');
  });
  it('has no cover slot without one', () => {
    const r = mount(<Card title="Boards" />);
    expect(r.querySelector('[data-slot="cover"]')).toBeNull();
  });
});
