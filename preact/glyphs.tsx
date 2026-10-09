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
  'arrow-down': ['M12 5v14', 'm19 12-7 7-7-7'],
  // Three dots, each a circle of radius 1 under the 2-unit stroke.
  more: ['M5 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2', 'M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2', 'M19 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2'],
  home: ['M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8', 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
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
