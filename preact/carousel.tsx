// <Carousel>: images filling a fixed frame, with a pager over them when there
// are two or more (see the core `carousel()`). An image that fails to load is
// dropped rather than shown broken; with none left, the `fallback` fills the
// same frame (or, without one, nothing renders).
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { carousel, stepIndex } from '@boogy/web';

export type CarouselImage = { src: string; alt?: string };

export type CarouselProps = {
  images: readonly CarouselImage[];
  /** What the images are of — the pager's accessible name. */
  label: string;
  /** Fills the frame when there is no image to show. Without one, an empty
   *  carousel renders nothing. */
  fallback?: ComponentChildren;
  /** Accessible names for the pager's controls. */
  previousLabel?: string;
  nextLabel?: string;
  imageLabel?: (n: number, count: number) => string;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'label'>;

const Chevron = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d={d} />
  </svg>
);

export function Carousel({
  images, label, fallback, previousLabel = 'Previous image', nextLabel = 'Next image',
  imageLabel = (n, count) => `Image ${n} of ${count}`, onKeyDown, ...rest
}: CarouselProps) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [index, setIndex] = useState(0);
  const key = images.map((i) => i.src).join('\n');
  // A different set of images starts over: nothing failed, the first shown.
  useEffect(() => { setFailed(new Set()); setIndex(0); }, [key]);

  const shown = images.filter((i) => !failed.has(i.src));
  if (shown.length === 0) {
    if (fallback == null) return null;
    return (
      <div {...rest} {...carousel({ count: 0 })}>
        <div data-slot="fallback">{fallback}</div>
      </div>
    );
  }
  const at = Math.min(index, shown.length - 1);
  const current = shown[at]!;
  const paged = shown.length > 1;
  const go = (delta: number) => setIndex(stepIndex(at, delta, shown.length));

  return (
    <div
      {...rest}
      {...carousel({ count: shown.length })}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (!paged || e.defaultPrevented) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      }}
    >
      <img
        key={current.src}
        src={current.src}
        alt={current.alt ?? ''}
        onError={() => setFailed((f) => new Set(f).add(current.src))}
      />
      {paged && (
        <>
          <button type="button" data-slot="prev" aria-label={previousLabel} onClick={() => go(-1)}>
            <span><Chevron d="m15 18-6-6 6-6" /></span>
          </button>
          <button type="button" data-slot="next" aria-label={nextLabel} onClick={() => go(1)}>
            <span><Chevron d="m9 18 6-6-6-6" /></span>
          </button>
          <div data-slot="dots">
            {shown.map((img, k) => (
              <button
                key={img.src}
                type="button"
                aria-label={imageLabel(k + 1, shown.length)}
                aria-current={k === at ? 'true' : undefined}
                onClick={() => setIndex(k)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
