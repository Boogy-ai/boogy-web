// revealOnScroll: call back once an element comes near the visible part of
// the page, then forget it. For an enumeration that grows long (a grid of
// samples, a list of rows): every item can exist from the start, labelled and
// reachable, while what is costly to draw (a painted pattern, an image, a
// chart) waits until it is about to be seen.
//
// One IntersectionObserver per margin serves every element watched at that
// margin, however many there are. With no IntersectionObserver at all, an
// element is revealed at once: nothing is ever withheld for good.

/** How far ahead of the view an element counts as near: a screen's worth of
 *  scrolling, so items are drawn before they arrive rather than as they do. */
const AHEAD = '600px';

type Watch = { observer: IntersectionObserver; callbacks: Map<Element, () => void>; made: typeof IntersectionObserver };
const watches = new Map<string, Watch>();

function watchAt(rootMargin: string): Watch {
  let w = watches.get(rootMargin);
  // Made again when the page's IntersectionObserver is not the one it was made
  // with (a polyfill installed later, a test's stand-in).
  if (!w || w.made !== IntersectionObserver) {
    const callbacks = new Map<Element, () => void>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const cb = callbacks.get(entry.target);
        callbacks.delete(entry.target);
        observer.unobserve(entry.target);
        cb?.();
      }
    }, { rootMargin });
    w = { observer, callbacks, made: IntersectionObserver };
    watches.set(rootMargin, w);
  }
  return w;
}

export interface RevealOptions {
  /** How far outside the view still counts as near (CSS margin). Default a
   *  screen's worth, 600px. */
  rootMargin?: string;
}

/** Call `onReveal` once, when `el` comes near the view. Returns a stop that
 *  forgets `el` if it has not been revealed yet. */
export function revealOnScroll(el: Element, onReveal: () => void, { rootMargin = AHEAD }: RevealOptions = {}): () => void {
  if (typeof IntersectionObserver !== 'function') {
    onReveal();
    return () => {};
  }
  const w = watchAt(rootMargin);
  w.callbacks.set(el, onReveal);
  w.observer.observe(el);
  return () => {
    if (!w.callbacks.delete(el)) return;
    w.observer.unobserve(el);
  };
}
