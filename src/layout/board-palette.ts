// The palette an app takes from the colour a board paints behind its pane.
// While an app shows the board's background, the board tells it that colour;
// these are the custom properties the SDK then sets on the page's root, so
// every component matches the board, and an app's own components can read the
// `--board-*` ones.
//
// - `--hue`, `--tint`: the SDK's text and frosted surfaces already read these;
//   they lean toward the board's hue, the tint capped so text stays neutral
//   enough to read.
// - `--ground-solid`: what covers the page (a sheet, a full-page popover) is the
//   board's colour rather than black, held dark enough for light text on a
//   light board (a light gradient); `--board-ground` stays the colour itself.
// - `--ground-raised`, `--ground-frost`: a step above the board.
// - `--accent`: the board's hue at a lightness and chroma that read on a dark
//   scheme; grey on a grey board.
// - `--board-field`: a light translucent wash, what a form field fills with.
import { hexToOklch, oklchToHex } from '../components/color-math';

export const BOARD_PALETTE_PROPS = [
  '--hue', '--tint', '--ground-solid', '--ground-raised', '--ground-frost', '--accent',
  '--board-ground', '--board-surface', '--board-accent', '--board-field',
] as const;
export type BoardPaletteProp = (typeof BOARD_PALETTE_PROPS)[number];
export type BoardPalette = Record<BoardPaletteProp, string>;

const HEX = /^#[0-9a-f]{6}$/;
/** How far text leans to the board's hue, at most. */
const TINT_MAX = 0.03;
/** Below this chroma a board is grey: its accent is grey too. */
const GREY = 0.02;
/** The lightest a surface starts from: a board can paint a light colour (a
 *  light gradient), but the pane still renders in the dark scheme, near-white
 *  text, so surfaces are held at or below this, keeping their hue. */
const SURFACE_MAX_L = 0.4;
const RAISE = 0.06;
const FROST = 0.04;
const ACCENT = { l: 0.78, c: 0.13 };
const FIELD = 'color-mix(in oklch, white 7%, transparent)';

const round = (n: number, places: number) => Number(n.toFixed(places));

/** The palette for a board colour, a `#rrggbb`. */
export function boardPalette(hex: string): BoardPalette {
  const colour = hex.toLowerCase();
  if (!HEX.test(colour)) throw new Error(`not a #rrggbb colour: ${hex}`);
  const { l, c, h } = hexToOklch(colour);
  const base = Math.min(l, SURFACE_MAX_L);
  const lift = (by: number) => oklchToHex({ l: base + by, c, h });
  const solid = l > SURFACE_MAX_L ? oklchToHex({ l: base, c, h }) : colour;
  const raised = lift(RAISE);
  const accent = oklchToHex({ l: ACCENT.l, c: c < GREY ? 0 : ACCENT.c, h });
  return {
    '--hue': String(round(h, 1)),
    '--tint': String(round(Math.min(c * 0.5, TINT_MAX), 4)),
    '--ground-solid': solid,
    '--ground-raised': raised,
    '--ground-frost': lift(FROST),
    '--accent': accent,
    '--board-ground': colour,
    '--board-surface': raised,
    '--board-accent': accent,
    '--board-field': FIELD,
  };
}
