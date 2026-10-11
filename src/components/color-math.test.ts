import { describe, it, expect } from 'vitest';
import { cssColorToHex, hexToHsv, hexToOklch, hsvToHex, oklchToHex } from './color-math';

/** The largest difference, in 8-bit steps, between two `#rrggbb`s' channels. */
const channelGap = (a: string, b: string) =>
  Math.max(...[1, 3, 5].map((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16))));

/** A spread of colours: greys, primaries, secondaries, near-black and
 *  near-white, and a pseudo-random sample across the cube. */
const SAMPLE = (() => {
  const fixed = ['#000000', '#ffffff', '#808080', '#010101', '#fefefe', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#00ffff', '#ff00ff', '#3a7bd5', '#f0b45a', '#123456', '#abcdef', '#7f0000', '#00007f'];
  let seed = 7;
  const next = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % 256; };
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  const random = Array.from({ length: 200 }, () => `#${hex(next())}${hex(next())}${hex(next())}`);
  return [...fixed, ...random];
})();

describe('hexToHsv / hsvToHex', () => {
  it('reads hue in degrees and saturation and brightness from 0 to 100', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 100, v: 100 });
    expect(hexToHsv('#00ff00')).toEqual({ h: 120, s: 100, v: 100 });
    expect(hexToHsv('#0000ff')).toEqual({ h: 240, s: 100, v: 100 });
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv('#ffffff')).toEqual({ h: 0, s: 0, v: 100 });
    const half = hexToHsv('#808080');
    expect(half.s).toBe(0);
    expect(half.v).toBeCloseTo(50.2, 1);
  });

  it('writes a lowercase #rrggbb', () => {
    expect(hsvToHex({ h: 0, s: 100, v: 100 })).toBe('#ff0000');
    expect(hsvToHex({ h: 60, s: 100, v: 100 })).toBe('#ffff00');
    expect(hsvToHex({ h: 210, s: 0, v: 100 })).toBe('#ffffff');
    expect(hsvToHex({ h: 210, s: 100, v: 0 })).toBe('#000000');
    // A hue of 360 is a hue of 0.
    expect(hsvToHex({ h: 360, s: 100, v: 100 })).toBe('#ff0000');
  });

  it('clamps what it is given: saturation and brightness to 0–100, hue around the circle', () => {
    expect(hsvToHex({ h: -120, s: 140, v: 120 })).toBe(hsvToHex({ h: 240, s: 100, v: 100 }));
    expect(hsvToHex({ h: 0, s: -5, v: -5 })).toBe('#000000');
  });

  it('counts a component that is no number (NaN, an infinity) as 0, never writing #NaN', () => {
    expect(hsvToHex({ h: Number.NaN, s: 100, v: 100 })).toBe('#ff0000');
    expect(hsvToHex({ h: 0, s: Number.NaN, v: 50 })).toBe(hsvToHex({ h: 0, s: 0, v: 50 }));
    expect(hsvToHex({ h: 0, s: 100, v: Number.NaN })).toBe('#000000');
    expect(hsvToHex({ h: Number.POSITIVE_INFINITY, s: Number.NEGATIVE_INFINITY, v: Number.POSITIVE_INFINITY })).toBe('#000000');
  });

  it('round-trips every sampled colour exactly', () => {
    for (const hex of SAMPLE) expect(hsvToHex(hexToHsv(hex)), hex).toBe(hex);
  });

  it('takes either case, and refuses anything that is not a #rrggbb', () => {
    expect(hexToHsv('#3A7BD5')).toEqual(hexToHsv('#3a7bd5'));
    expect(() => hexToHsv('#12345')).toThrow(RangeError);
    expect(() => hexToHsv('red')).toThrow(RangeError);
  });
});

// The reference values were computed independently: sRGB → linear → XYZ (D65)
// → LMS with the CSS Color 4 XYZ→LMS matrix → OKLab. #3a7bd5 gives
// L 0.58619, C 0.15327, H 257.23°.
describe('hexToOklch', () => {
  it('converts a #rrggbb to OKLCH', () => {
    const black = hexToOklch('#000000');
    expect(Math.abs(black.l)).toBeLessThan(1e-6);
    expect(Math.abs(black.c)).toBeLessThan(1e-6);
    const white = hexToOklch('#ffffff');
    expect(white.l).toBeCloseTo(1, 3);
    expect(white.c).toBeLessThan(1e-3);
    expect(white.h).toBe(0); // a grey has no hue
    const blue = hexToOklch('#3a7bd5');
    expect(Math.abs(blue.h - 257.23)).toBeLessThan(2);
    expect(Math.abs(blue.l - 0.5862)).toBeLessThan(0.005);
    expect(Math.abs(blue.c - 0.1533)).toBeLessThan(0.005);
    expect(hexToOklch('#3A7BD5')).toEqual(blue);
    expect(() => hexToOklch('#12345')).toThrow(RangeError);
  });
});

describe('oklchToHex', () => {
  it('round-trips every sampled colour within one 8-bit step per channel', () => {
    for (const hex of SAMPLE) {
      const back = oklchToHex(hexToOklch(hex));
      expect(channelGap(back, hex), `${hex} → ${back}`).toBeLessThanOrEqual(1);
    }
  });

  it('maps a colour outside sRGB into it by lowering its chroma, keeping lightness and hue', () => {
    // Far more chroma than sRGB holds at this lightness and hue.
    const out = oklchToHex({ l: 0.7, c: 0.4, h: 150 });
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
    const back = hexToOklch(out);
    expect(back.l).toBeCloseTo(0.7, 1);
    expect(Math.abs(back.h - 150)).toBeLessThan(3);
    expect(back.c).toBeLessThan(0.4);
    // ...and as much chroma as sRGB allows: a touch more would leave it.
    expect(back.c).toBeGreaterThan(0.15);
  });

  it('counts a component that is no number (NaN, an infinity) as 0, never writing #NaN', () => {
    expect(oklchToHex({ l: 0.5, c: 0, h: Number.NaN })).toBe(oklchToHex({ l: 0.5, c: 0, h: 0 }));
    expect(oklchToHex({ l: 0.5, c: 0.1, h: Number.NaN })).toBe(oklchToHex({ l: 0.5, c: 0.1, h: 0 }));
    expect(oklchToHex({ l: 0.5, c: Number.NaN, h: 120 })).toBe(oklchToHex({ l: 0.5, c: 0, h: 120 }));
    expect(oklchToHex({ l: Number.NaN, c: 0.1, h: 120 })).toBe('#000000');
    expect(oklchToHex({ l: 0.5, c: Number.POSITIVE_INFINITY, h: 120 })).toBe(oklchToHex({ l: 0.5, c: 0, h: 120 }));
  });

  it('clamps lightness to 0–1: past white is white, below black is black', () => {
    expect(oklchToHex({ l: 1.2, c: 0, h: 0 })).toBe('#ffffff');
    expect(oklchToHex({ l: -0.1, c: 0.1, h: 30 })).toBe('#000000');
  });
});

describe('cssColorToHex', () => {
  it('reads the forms a browser computes a colour to', () => {
    expect(cssColorToHex('#3A7BD5')).toBe('#3a7bd5');
    expect(cssColorToHex('#fff')).toBe('#ffffff');
    expect(cssColorToHex('rgb(58, 123, 213)')).toBe('#3a7bd5');
    expect(cssColorToHex('rgba(58, 123, 213, 0.5)')).toBe('#3a7bd5');
    expect(cssColorToHex('rgb(58 123 213 / 50%)')).toBe('#3a7bd5');
    expect(cssColorToHex('color(srgb 0.227451 0.482353 0.835294)')).toBe('#3a7bd5');
    expect(cssColorToHex('oklch(0.58619 0.15327 257.23)')).toBe('#3a7bd5');
    expect(cssColorToHex('oklch(58.619% 0.15327 257.23)')).toBe('#3a7bd5');
    expect(cssColorToHex('oklch(0.58619 0.15327 257.23 / 0.4)')).toBe('#3a7bd5');
  });

  it('is null for what it cannot read', () => {
    expect(cssColorToHex('')).toBeNull();
    expect(cssColorToHex('transparent')).toBeNull();
    expect(cssColorToHex('var(--x)')).toBeNull();
    expect(cssColorToHex('lab(50 20 30)')).toBeNull();
    expect(cssColorToHex('rgb(1, 2)')).toBeNull();
  });
});
