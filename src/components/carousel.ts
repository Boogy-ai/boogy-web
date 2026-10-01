// Carousel: one or more images in a fixed frame, each filling it (CSS `cover`).
// With two or more, a pager sits over the image — previous and next beside it,
// one dot per image along the bottom — and paging wraps round at either end.
// With one image there is nothing to page, so there is no pager. With none,
// the frame holds whatever the caller gives as its fallback — the frame is the
// building block; what an empty one shows is the app's decision.

export interface CarouselAttrs {
  'data-boogy': 'carousel';
  /** Whether the pager is shown: two or more images. */
  'data-paged': 'true' | 'false';
}

export function carousel(opts: { count: number }): CarouselAttrs {
  return { 'data-boogy': 'carousel', 'data-paged': opts.count > 1 ? 'true' : 'false' };
}

/** The index `delta` steps from `index` among `count` images, wrapping round:
 *  forward from the last is the first, back from the first is the last. */
export function stepIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + delta) % count) + count) % count;
}
