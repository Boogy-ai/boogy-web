// Whether an element has come near the visible part of the page yet: false
// until it does, then true for good. See `revealOnScroll()`. For a long list
// or grid whose items are costly to draw: render each item, and draw its costly
// part once this says so.
import { useLayoutEffect, useState } from 'preact/hooks';
import { revealOnScroll, type RevealOptions } from '@boogy/web';

export function useRevealed(ref: { current: Element | null }, { enabled = true, ...opts }: RevealOptions & {
  /** False reveals at once (nothing is withheld). Default true. */
  enabled?: boolean;
} = {}): boolean {
  const [revealed, setRevealed] = useState(!enabled);
  useLayoutEffect(() => {
    if (revealed) return;
    if (!enabled) { setRevealed(true); return; }
    const el = ref.current;
    if (!el) return;
    return revealOnScroll(el, () => setRevealed(true), opts);
  }, [revealed, enabled, opts.rootMargin]);
  return revealed;
}
