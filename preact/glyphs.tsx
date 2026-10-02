// The shapes the SDK draws, defined once. One frame: a 24-unit box, a 2-unit
// round stroke in the current colour, hidden from assistive tech (the control
// around a glyph carries its name). Its size comes from the icon tokens in the
// stylesheet, not an `em` literal, so it follows the unit and the zoom.
import type { JSX } from 'preact';

const PATHS = {
  back: ['m15 18-6-6 6-6'],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  send: ['m5 12 7-7 7 7', 'M12 19V5'],
  check: ['M20 6 9 17l-5-5'],
  'check-double': ['M18 6 7 17l-5-5', 'm22 10-7.5 7.5L13 16'],
} as const;

export type GlyphShape = keyof typeof PATHS;

export type GlyphProps = { shape: GlyphShape; size?: 'sm' | 'md' } & Omit<JSX.SVGAttributes<SVGSVGElement>, 'size'>;

export function Glyph({ shape, size = 'md', ...rest }: GlyphProps) {
  return (
    <svg {...rest} data-boogy="glyph" data-size={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      {PATHS[shape].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
