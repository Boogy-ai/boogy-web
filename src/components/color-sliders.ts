// ColorSliders: one colour as three sliders, Hue, Saturation and Lightness,
// measured in OKLCH so that equal steps look equal.
//
// - Hue: 0–359 degrees round the OKLCH hue circle.
// - Saturation: 0–100, the colour's chroma as a share of the MOST chroma a
//   screen can show at its lightness and hue (`maxChroma`). 100 is always a
//   colour a screen shows, and moving Hue or Lightness never pushes it out.
// - Lightness: OKLCH lightness × 100, optionally held inside a range (a
//   background kept dark enough for light text on it, say).
//
// Each slider's track is drawn through what it changes, from the colour as it
// is: Hue round the circle, Saturation from grey to the most, Lightness over
// its range.
import { hexToOklch, maxChroma, oklchToHex } from './color-math';

export interface ColorSlidersAttrs { 'data-boogy': 'color-sliders' }
export function colorSliders(): ColorSlidersAttrs {
  return { 'data-boogy': 'color-sliders' };
}

/** The three sliders' values: `h` 0–359, `s` 0–100, `l` 0–100. */
export interface ColorSliderValues { h: number; s: number; l: number }

/** A range OKLCH lightness is held inside, each end 0–1. */
export interface LightnessRange { min: number; max: number }

const FULL: LightnessRange = { min: 0, max: 1 };
/** Below this chroma a colour is a grey: it has no hue of its own. */
const GREY = 1e-3;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A `#rrggbb` as the sliders read it. Its lightness is held inside `range`;
 *  a grey, which has no hue, takes `keepHue` (where the Hue slider was). */
export function hexToSliders(hex: string, range: LightnessRange = FULL, keepHue?: number): ColorSliderValues {
  const { l, c, h } = hexToOklch(hex);
  const light = clamp(l, range.min, range.max);
  const most = maxChroma(light, h);
  const grey = c < GREY;
  return {
    h: grey && keepHue !== undefined ? keepHue : Math.round(h) % 360,
    s: grey || most === 0 ? 0 : Math.round(Math.min(1, c / most) * 100),
    l: Math.round(light * 100),
  };
}

/** The colour the sliders make, as a `#rrggbb`. */
export function slidersToHex({ h, s, l }: ColorSliderValues): string {
  const light = clamp(l, 0, 100) / 100;
  return oklchToHex({ l: light, c: (maxChroma(light, h) * clamp(s, 0, 100)) / 100, h });
}

const gradient = (stops: string[]) => `linear-gradient(to right, ${stops.join(', ')})`;
const steps = (n: number) => Array.from({ length: n }, (_, i) => i / (n - 1));

/** Each slider's track, as a CSS gradient through what it changes. */
export function sliderTracks(v: ColorSliderValues, range: LightnessRange = FULL): { hue: string; saturation: string; lightness: string } {
  const lo = Math.round(range.min * 100);
  const hi = Math.round(range.max * 100);
  // A grey's hue track would be all grey: it shows the hues at a middling
  // saturation instead, so the slider still says what it does.
  const hueSat = Math.max(v.s, 50);
  return {
    hue: gradient(steps(13).map((t) => slidersToHex({ h: t * 360, s: hueSat, l: v.l }))),
    saturation: gradient(steps(6).map((t) => slidersToHex({ h: v.h, s: t * 100, l: v.l }))),
    lightness: gradient(steps(6).map((t) => slidersToHex({ h: v.h, s: v.s, l: lo + t * (hi - lo) }))),
  };
}
