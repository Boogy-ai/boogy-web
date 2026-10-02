// <SeededArt>: art seeded from a string, drawn as an SVG that fills its
// nearest positioned ancestor, cropped to cover it. Decorative.
import type { JSX } from 'preact';
import { useId } from 'preact/hooks';
import { seededArt, SEEDED_ART_H, SEEDED_ART_W } from '@boogy/web';

export type SeededArtProps = {
  /** What the art is drawn from: the same seed always draws the same art. */
  seed: string;
} & Omit<JSX.SVGAttributes<SVGSVGElement>, 'seed'>;

export function SeededArt({ seed, ...rest }: SeededArtProps) {
  const art = seededArt(seed);
  // Gradient ids must be unique on the page; several pieces of art share it.
  const id = useId();
  return (
    <svg {...rest} data-boogy="seeded-art" viewBox={`0 0 ${SEEDED_ART_W} ${SEEDED_ART_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-bg`} gradientTransform={`rotate(${art.angle} 0.5 0.5)`}>
          <stop offset="0" stop-color={art.from} />
          <stop offset="1" stop-color={art.to} />
        </linearGradient>
        {art.blobs.map((b, i) => (
          <radialGradient key={i} id={`${id}-b${i}`}>
            <stop offset="0" stop-color={b.color} stop-opacity="0.95" />
            <stop offset="1" stop-color={b.color} stop-opacity="0" />
          </radialGradient>
        ))}
      </defs>
      <rect width={SEEDED_ART_W} height={SEEDED_ART_H} fill={`url(#${id}-bg)`} />
      {art.blobs.map((b, i) => (
        <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={`url(#${id}-b${i})`} />
      ))}
    </svg>
  );
}
