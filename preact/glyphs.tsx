// The shapes the SDK draws, defined once. One frame: a 24-unit box, a 2-unit
// round stroke in the current colour, hidden from assistive tech (the control
// around a glyph carries its name). Its size comes from the icon tokens in the
// stylesheet, not an `em` literal, so it follows the unit and the zoom.
import type { JSX } from 'preact';

const PATHS = {
  back: ['m15 18-6-6 6-6'],
  // Back's chevron, turned to point ahead: Forward, and a row that opens more.
  forward: ['m9 18 6-6-6-6'],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  send: ['m5 12 7-7 7 7', 'M12 19V5'],
  check: ['M20 6 9 17l-5-5'],
  'check-double': ['M18 6 7 17l-5-5', 'm22 10-7.5 7.5L13 16'],
  'arrow-down': ['M12 5v14', 'm19 12-7 7-7-7'],
  // An "A" with a small arrow beside it, down for smaller text and up for larger.
  'text-smaller': ['m14 12 4 4 4-4', 'M18 16V7', 'm2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16', 'M3.304 13h6.392'],
  'text-larger': ['m14 11 4-4 4 4', 'M18 16V7', 'm2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16', 'M3.304 13h6.392'],
  // Three dots stacked (the vertical overflow button), each a circle of
  // radius 1 under the 2-unit stroke.
  more: ['M12 4a1 1 0 1 0 0 2a1 1 0 1 0 0-2', 'M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2', 'M12 18a1 1 0 1 0 0 2a1 1 0 1 0 0-2'],
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
