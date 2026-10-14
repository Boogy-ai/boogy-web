import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { revealOnScroll } from './reveal';

// A stand-in IntersectionObserver: records what it observes, and lets a test
// say an element came into view.
class FakeObserver {
  static all: FakeObserver[] = [];
  observed = new Set<Element>();
  constructor(public cb: IntersectionObserverCallback, public opts: IntersectionObserverInit = {}) { FakeObserver.all.push(this); }
  observe(el: Element) { this.observed.add(el); }
  unobserve(el: Element) { this.observed.delete(el); }
  disconnect() { this.observed.clear(); }
  show(el: Element, isIntersecting = true) {
    this.cb([{ target: el, isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}
const real = globalThis.IntersectionObserver;
// A class of its own per test: the module keeps one observer per margin, made
// again only for a different IntersectionObserver.
beforeEach(() => { FakeObserver.all = []; (globalThis as { IntersectionObserver: unknown }).IntersectionObserver = class extends FakeObserver {}; });
afterEach(() => { (globalThis as { IntersectionObserver: unknown }).IntersectionObserver = real; });

describe('revealOnScroll', () => {
  it('calls back once an element comes near the view, then stops watching it', () => {
    const a = document.createElement('div');
    const onReveal = vi.fn();
    revealOnScroll(a, onReveal);
    const io = FakeObserver.all[0];
    io.show(a, false);
    expect(onReveal).not.toHaveBeenCalled();
    io.show(a);
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(io.observed.has(a)).toBe(false);
    io.show(a);
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('one observer for many elements at the same margin, and a margin ahead of the view by default', () => {
    for (let i = 0; i < 50; i++) revealOnScroll(document.createElement('div'), () => {});
    expect(FakeObserver.all).toHaveLength(1);
    expect(FakeObserver.all[0].observed.size).toBe(50);
    expect(FakeObserver.all[0].opts.rootMargin).toMatch(/px/);
    revealOnScroll(document.createElement('div'), () => {}, { rootMargin: '0px' });
    expect(FakeObserver.all).toHaveLength(2);
  });

  it('the returned stop forgets an element that never came into view', () => {
    const a = document.createElement('div');
    const onReveal = vi.fn();
    const stop = revealOnScroll(a, onReveal);
    stop();
    expect(FakeObserver.all[0].observed.has(a)).toBe(false);
    FakeObserver.all[0].show(a);
    expect(onReveal).not.toHaveBeenCalled();
  });

  it('with no IntersectionObserver (an old browser, a test page), everything is revealed at once', () => {
    (globalThis as { IntersectionObserver: unknown }).IntersectionObserver = undefined;
    const onReveal = vi.fn();
    revealOnScroll(document.createElement('div'), onReveal);
    expect(onReveal).toHaveBeenCalledTimes(1);
  });
});
