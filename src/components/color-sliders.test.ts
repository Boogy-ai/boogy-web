import { describe, it, expect } from 'vitest';
import { colorSliders, hexToSliders, slidersToHex, sliderTracks } from './color-sliders';
import { hexToOklch, maxChroma } from './color-math';

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const BAND = { min: 0.14, max: 0.4 };

describe('colorSliders()', () => {
  it('names the group', () => expect(colorSliders()).toEqual({ 'data-boogy': 'color-sliders' }));
});

describe('hexToSliders / slidersToHex', () => {
  it('a colour read into the sliders and back is the same colour, within 8-bit steps', () => {
    for (const hex of ['#232f47', '#3e2a2e', '#1e3833', '#808080', '#d97757', '#3a7bd5', '#121316', '#f0e6d2', '#5b6b8f']) {
      const back = slidersToHex(hexToSliders(hex));
      const a = channels(hex);
      const b = channels(back);
      a.forEach((v, i) => expect(Math.abs(v - b[i]), `${hex} → ${back}`).toBeLessThanOrEqual(3));
    }
  });

  it('every position of the sliders is a colour a screen can show', () => {
    for (let h = 0; h < 360; h += 45) for (let s = 0; s <= 100; s += 25) for (let l = 0; l <= 100; l += 20) {
      const hex = slidersToHex({ h, s, l });
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      const o = hexToOklch(hex);
      expect(o.c, `${h} ${s} ${l}`).toBeLessThanOrEqual(maxChroma(l / 100, h) + 0.01);
    }
  });

  it('Saturation is a share of the most chroma at that lightness and hue: 100 is the most', () => {
    const v = hexToSliders(slidersToHex({ h: 250, s: 100, l: 50 }));
    expect(v.s).toBeGreaterThanOrEqual(98);
  });

  it('a lightness range clamps what the sliders read', () => {
    expect(hexToSliders('#ffffff', BAND).l).toBe(40);
    expect(hexToSliders('#000000', BAND).l).toBe(14);
    expect(hexToSliders('#232f47', BAND).l).toBe(Math.round(hexToOklch('#232f47').l * 100));
  });

  it('a grey keeps the hue it is given (it has none of its own)', () => {
    expect(hexToSliders('#808080', undefined, 200).h).toBe(200);
    expect(hexToSliders('#808080').s).toBe(0);
    expect(hexToSliders('#3a7bd5', undefined, 10).h).not.toBe(10);
  });
});

describe('sliderTracks', () => {
  it('a gradient per slider, each through what it changes', () => {
    const t = sliderTracks({ h: 250, s: 60, l: 30 }, BAND);
    for (const g of [t.hue, t.saturation, t.lightness]) {
      expect(g.startsWith('linear-gradient(to right,')).toBe(true);
      expect(g.match(/#[0-9a-f]{6}/g)!.length).toBeGreaterThanOrEqual(6);
    }
    // Lightness runs from the range's low end to its high end.
    const stops = t.lightness.match(/#[0-9a-f]{6}/g)!;
    expect(Math.round(hexToOklch(stops[0]).l * 100)).toBe(14);
    expect(Math.round(hexToOklch(stops[stops.length - 1]).l * 100)).toBe(40);
    // Saturation starts grey.
    expect(hexToOklch(t.saturation.match(/#[0-9a-f]{6}/)![0]).c).toBeLessThan(0.005);
  });
});
