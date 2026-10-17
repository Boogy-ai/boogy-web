// The shapes the SDK draws, defined once. One frame: a 24-unit box, a 2-unit
// round stroke in the current colour, hidden from assistive tech (the control
// around a glyph carries its name). Its size comes from the icon tokens in the
// stylesheet, not an `em` literal, so it follows the unit and the zoom.
import type { JSX } from 'preact';

const PATHS = {
  back: ['m15 18-6-6 6-6'],
  // Back's chevron, turned to point ahead: Forward, and a row that opens more.
  forward: ['m9 18 6-6-6-6'],
  // Pointing down: a control that opens a list below it.
  'chevron-down': ['m6 9 6 6 6-6'],
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
  // Settings-style section marks, drawn in the same 24-unit frame.
  // A pencil, writing down-left: a name, a label, anything typed.
  pencil: ['M4 20l1-4L16 5l3 3L8 19z', 'M14 7l3 3'],
  // A framed picture, a hill and a sun: a background, an image.
  image: ['M4 5h16v14H4z', 'm4 16 5-5 4 4 2-2 5 5', 'M16.5 9a1.5 1.5 0 1 1-3 0a1.5 1.5 0 1 1 3 0'],
  // A plain square outline: an edge, a border, a frame.
  square: ['M5 5h14v14H5z'],
  // A serif-less capital T: type, a font.
  type: ['M5 7V5h14v2', 'M12 5v14', 'M9 19h6'],
  // A drop: a colour, a fill.
  droplet: ['M12 3l5.2 7.4a6.3 6.3 0 1 1-10.4 0z'],
  // An arrow rising out of a tray: send a file up.
  upload: ['M12 15V4', 'm7 9 5-5 5 5', 'M5 20h14'],
  // A plus: add, make a new one.
  plus: ['M5 12h14', 'M12 5v14'],
  trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12', 'M9 7V4h6v3'],
  info: ['M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20', 'M12 16v-4', 'M12 8h.01'],
  // Two sheets, one over the other: copy.
  copy: ['M10 9h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z', 'M5 15H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1'],
  // Two links of a chain: a link, an address to share.
  link: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  lock: ['M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  // Two people, one behind the other: members, people, a group.
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M13 7a4 4 0 1 1-8 0a4 4 0 1 1 8 0', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  // A frame with a column down its start side: a side panel, shown or hidden.
  sidebar: ['M4 5h16v14H4z', 'M9.5 5v14'],
  // A hash: a channel, a topic, a room.
  hash: ['M4 9h16', 'M4 15h16', 'M10 3L8 21', 'M16 3l-2 18'],
  // A cog: settings.
  settings: [
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
    'M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0',
  ],
  // A box with its lid: set aside, kept.
  archive: ['M3 3h18v5H3z', 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8', 'M10 12h4'],
  // A three-by-three grid: a pattern, a tiling.
  grid: ['M4 4h16v16H4z', 'M4 9.33h16', 'M4 14.67h16', 'M9.33 4v16', 'M14.67 4v16'],
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
