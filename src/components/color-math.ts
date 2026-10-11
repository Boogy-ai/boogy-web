// Colour math: `#rrggbb` to and from HSV (what a colour picker's area and hue
// strip move through) and OKLCH (a perceptual space: equal steps of lightness
// look equal, so a palette built in it is even). Pure functions over sRGB.
//
//   * A hex is `#` and six hex digits; one written here is lowercase.
//   * HSV: hue in degrees [0, 360), saturation and brightness 0–100. Values
//     are not rounded, so a hex → HSV → hex round trip is exact.
//   * OKLCH: lightness 0–1, chroma from 0 (a grey), hue in degrees (0 for a
//     grey). Björn Ottosson's published matrices, sRGB ↔ linear ↔ LMS ↔ OKLab.
//   * A colour OKLCH can name but sRGB cannot show is brought into sRGB by
//     lowering its chroma, keeping its lightness and hue: the nearest colour a
//     screen can show that still reads as the same lightness and hue.

/** Hue in degrees [0, 360), saturation and brightness (value) 0–100. */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

/** Lightness 0–1, chroma (0 is a grey), hue in degrees. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** The three channels of a `#rrggbb`, each 0–1. */
function channels(hex: string): [number, number, number] {
  if (!HEX.test(hex)) throw new RangeError(`not a #rrggbb colour: ${hex}`);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** Channels 0–1 as a lowercase `#rrggbb`, each clamped and rounded to 8 bits. */
function toHex(r: number, g: number, b: number): string {
  const byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** A component that is no number (NaN, an infinity) counts as 0. */
const finite = (n: number) => (Number.isFinite(n) ? n : 0);
/** A hue in [0, 360), never -0. */
const turn = (h: number) => ((h % 360) + 360) % 360 || 0;

/** A `#rrggbb` in HSV. A grey's hue is 0, and black's saturation is 0. */
export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = channels(hex);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: turn(h), s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}

/** An HSV colour as a `#rrggbb`. Saturation and brightness are clamped to
 *  0–100, and the hue is taken around the circle (360 is 0, -120 is 240). A
 *  component that is no number (NaN, an infinity) counts as 0. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = turn(finite(h)) / 60;
  const sat = clamp(finite(s), 0, 100) / 100;
  const val = clamp(finite(v), 0, 100) / 100;
  const f = (n: number) => {
    const k = (n + hue) % 6;
    return val - val * sat * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return toHex(f(5), f(3), f(1));
}

/** Below this chroma a colour is a grey, and its hue is rounding noise. */
const ACHROMATIC = 1e-4;

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

/** A `#rrggbb` in OKLCH. A grey has chroma 0 and hue 0. */
export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = channels(hex).map(toLinear);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const l = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const c = Math.hypot(a, bb);
  if (c < ACHROMATIC) return { l, c: 0, h: 0 };
  return { l, c, h: turn((Math.atan2(bb, a) * 180) / Math.PI) };
}

/** OKLCH to linear sRGB, unclamped: a channel outside 0–1 is out of gamut. */
function oklchToLinear(l: number, c: number, h: number): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_,
  ];
}

/** How far outside 0–1 a channel may be and still count as in gamut. */
const GAMUT_SLACK = 1e-6;
const inGamut = (rgb: number[]) => rgb.every((v) => v >= -GAMUT_SLACK && v <= 1 + GAMUT_SLACK);

/** An OKLCH colour as a `#rrggbb`. Lightness is clamped to 0–1; a colour
 *  outside sRGB keeps its lightness and hue and loses chroma until a screen
 *  can show it. A component that is no number (NaN, an infinity) counts as 0. */
export function oklchToHex({ l, c, h: hue }: Oklch): string {
  const light = clamp(finite(l), 0, 1);
  const h = finite(hue);
  let chroma = Math.max(0, finite(c));
  if (!inGamut(oklchToLinear(light, chroma, h))) {
    // Bisect: `lo` is in gamut (a grey always is), `hi` is not.
    let lo = 0;
    let hi = chroma;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(light, mid, h))) lo = mid;
      else hi = mid;
    }
    chroma = lo;
  }
  const [r, g, b] = oklchToLinear(light, chroma, h).map(fromLinear);
  return toHex(r, g, b);
}

/** The arguments of a colour function, before any `/ alpha`, split on spaces
 *  or commas. */
const args = (inner: string) => inner.split('/')[0].trim().split(/[\s,]+/).filter(Boolean);

/** A number, or a percentage of `whole`; `none` is 0; anything else is NaN. */
function amount(token: string, whole: number): number {
  if (!token) return Number.NaN;
  if (token === 'none') return 0;
  if (token.endsWith('%')) return (Number(token.slice(0, -1)) / 100) * whole;
  return Number(token.replace(/deg$/, ''));
}

/** A colour as a browser computes it (`rgb()`/`rgba()`, `color(srgb …)`,
 *  `oklch()`, or a hex of 3, 4, 6 or 8 digits) as a `#rrggbb`, ignoring any
 *  alpha; null for any other form. An OKLCH colour outside sRGB is brought
 *  into it as `oklchToHex` does. */
export function cssColorToHex(css: string): string | null {
  const s = css.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (hex) {
    const d = hex[1];
    return d.length <= 4 ? `#${d[0]}${d[0]}${d[1]}${d[1]}${d[2]}${d[2]}` : `#${d.slice(0, 6)}`;
  }
  const fn = /^(rgba?|color|oklch)\((.*)\)$/.exec(s);
  if (!fn) return null;
  const parts = args(fn[2]);
  let values: number[];
  if (fn[1] === 'color') {
    if (parts[0] !== 'srgb') return null;
    values = parts.slice(1, 4).map((t) => amount(t, 1));
  } else if (fn[1] === 'oklch') {
    values = [amount(parts[0] ?? '', 1), amount(parts[1] ?? '', 0.4), amount(parts[2] ?? '', 1)];
  } else {
    values = parts.slice(0, 3).map((t) => amount(t, 255) / 255);
  }
  if (values.length < 3 || values.some((v) => !Number.isFinite(v))) return null;
  const [x, y, z] = values;
  return fn[1] === 'oklch' ? oklchToHex({ l: x, c: y, h: z }) : toHex(x, y, z);
}
