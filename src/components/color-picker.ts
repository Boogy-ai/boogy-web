// ColorPicker: one colour from a grid of swatches, or any colour from its own
// custom section (a saturation and brightness area, a hue strip and a hex
// field), with an optional transparency slider.
//
//   * The grid is ONE tab stop: the chosen swatch (else the first). Arrow keys
//     move focus between swatches, stopping at the edges; Home and End go to
//     the first and last. Moving focus chooses nothing: Enter, Space or a
//     click chooses, so stepping through the grid saves nothing on the way.
//   * Every other part commits when the person lets go, never on every step:
//     a drag on the area or a strip commits on release; a key held on the
//     area, the hue strip or the slider moves what is shown, and commits once
//     when it is released; the hex field commits on Enter or when it loses
//     focus, and only a well-formed `#rrggbb`.
//   * Every key the picker handles is marked handled (`preventDefault`), so a
//     menu it sits in does not act on the same key press.

export interface ColorPickerAttrs {
  'data-boogy': 'color-picker';
}

export function colorPicker(): ColorPickerAttrs {
  return { 'data-boogy': 'color-picker' };
}

/** One colour in the grid: its id (what is chosen), its name, and how to draw it. */
export interface ColorSwatch {
  id: string;
  label: string;
  /** Any CSS colour (a var() is fine). */
  color: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** `#rrggbb`, lowercase, or null when `s` is not one (accepts uppercase and normalises). */
export function parseHexColor(s: string): string | null {
  return HEX.test(s) ? s.toLowerCase() : null;
}

/** An integer 0–100. */
export function clampPercent(n: number): number {
  return Number.isNaN(n) ? 0 : Math.min(100, Math.max(0, Math.round(n)));
}

/** The swatch a key moves focus to from swatch `index` of `count`, laid out in
 *  rows of `columns`, or null when the key is not one the grid handles. Left
 *  and Right step by one through reading order, Up and Down by a row; none of
 *  them wraps, and Down onto a short last row lands on its last swatch. */
export function moveInGrid(key: string, index: number, count: number, columns: number): number | null {
  const last = count - 1;
  switch (key) {
    case 'ArrowRight': return Math.min(index + 1, last);
    case 'ArrowLeft': return Math.max(index - 1, 0);
    case 'ArrowDown': return index + columns <= last ? index + columns : Math.floor(index / columns) < Math.floor(last / columns) ? last : index;
    case 'ArrowUp': return index - columns >= 0 ? index - columns : index;
    case 'Home': return 0;
    case 'End': return last;
    default: return null;
  }
}

/** The value a key moves a 0–100 slider to from `value`, or null when the key
 *  is not one a slider handles: arrows step by one, Page Up and Page Down by
 *  ten, Home and End go to the ends. */
export function stepPercent(key: string, value: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp': return clampPercent(value + 1);
    case 'ArrowLeft':
    case 'ArrowDown': return clampPercent(value - 1);
    case 'PageUp': return clampPercent(value + 10);
    case 'PageDown': return clampPercent(value - 10);
    case 'Home': return 0;
    case 'End': return 100;
    default: return null;
  }
}

/** The highest hue the hue strip takes, in degrees (360 is 0 again). */
export const MAX_HUE = 359;

/** Where a key moves the area's point from saturation `s` and brightness `v`
 *  (each 0–100), or null when the key is not one the area handles: Left and
 *  Right step saturation, Up and Down brightness, by one, or by ten with `big`
 *  (Shift held); Home and End take saturation to its ends (the area's left and
 *  right edges); Page Up and Page Down step brightness by ten. Clamped to
 *  0–100, and from exactly where it is, so a step there and back is no move. */
export function stepArea(key: string, { s, v }: { s: number; v: number }, big = false): { s: number; v: number } | null {
  const d = big ? 10 : 1;
  const to = (n: number) => Math.min(100, Math.max(0, n));
  switch (key) {
    case 'ArrowRight': return { s: to(s + d), v };
    case 'ArrowLeft': return { s: to(s - d), v };
    case 'ArrowUp': return { s, v: to(v + d) };
    case 'ArrowDown': return { s, v: to(v - d) };
    case 'Home': return { s: 0, v };
    case 'End': return { s: 100, v };
    case 'PageUp': return { s, v: to(v + 10) };
    case 'PageDown': return { s, v: to(v - 10) };
    default: return null;
  }
}

/** The hue a key moves the hue strip to from `hue`, or null when the key is
 *  not one the strip handles: arrows step by one degree (ten with `big`, Shift
 *  held), Page Up and Page Down by ten, Home and End go to the ends; clamped to
 *  0–`MAX_HUE`. From exactly where it is, so a step there and back is no move. */
export function stepHue(key: string, hue: number, big = false): number | null {
  const to = (n: number) => Math.min(MAX_HUE, Math.max(0, n));
  const d = big ? 10 : 1;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp': return to(hue + d);
    case 'ArrowLeft':
    case 'ArrowDown': return to(hue - d);
    case 'PageUp': return to(hue + 10);
    case 'PageDown': return to(hue - 10);
    case 'Home': return 0;
    case 'End': return MAX_HUE;
    default: return null;
  }
}
