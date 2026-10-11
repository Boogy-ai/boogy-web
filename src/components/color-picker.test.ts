import { describe, it, expect } from 'vitest';
import { clampPercent, colorPicker, moveInGrid, parseHexColor, stepArea, stepHue, stepPercent } from './color-picker';

describe('colorPicker', () => {
  it('marks the element', () => {
    expect(colorPicker()).toEqual({ 'data-boogy': 'color-picker' });
  });
});

describe('parseHexColor', () => {
  it('takes #rrggbb in either case and gives it lowercase', () => {
    expect(parseHexColor('#3A7BD5')).toBe('#3a7bd5');
    expect(parseHexColor('#3a7bd5')).toBe('#3a7bd5');
  });
  it('refuses anything else: no #, a short or long form, a non-hex digit, a name, surrounding space', () => {
    expect(parseHexColor('3a7bd5')).toBeNull();
    expect(parseHexColor('#12345')).toBeNull();
    expect(parseHexColor('#1234567')).toBeNull();
    expect(parseHexColor('#fff')).toBeNull();
    expect(parseHexColor('#gggggg')).toBeNull();
    expect(parseHexColor('red')).toBeNull();
    expect(parseHexColor(' #3a7bd5')).toBeNull();
    expect(parseHexColor('')).toBeNull();
  });
});

describe('clampPercent', () => {
  it('is an integer from 0 to 100', () => {
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(33.6)).toBe(34);
    expect(clampPercent(33.4)).toBe(33);
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(100)).toBe(100);
  });
  it('a value that is no number is 0, never NaN', () => {
    expect(clampPercent(Number.NaN)).toBe(0);
  });
});

describe('moveInGrid', () => {
  // 14 swatches in rows of 7.
  const at = (key: string, from: number) => moveInGrid(key, from, 14, 7);
  it('Left and Right step by one, stopping at either end', () => {
    expect(at('ArrowRight', 0)).toBe(1);
    expect(at('ArrowLeft', 1)).toBe(0);
    expect(at('ArrowLeft', 0)).toBe(0);
    expect(at('ArrowRight', 13)).toBe(13);
    // Across a row's end, as reading order runs.
    expect(at('ArrowRight', 6)).toBe(7);
  });
  it('Up and Down step by a row, staying put where there is no row', () => {
    expect(at('ArrowDown', 0)).toBe(7);
    expect(at('ArrowUp', 7)).toBe(0);
    expect(at('ArrowUp', 3)).toBe(3);
    expect(at('ArrowDown', 10)).toBe(10);
  });
  it('Down onto a short last row lands on its last swatch', () => {
    // 10 swatches in rows of 7: the second row holds 7, 8, 9.
    expect(moveInGrid('ArrowDown', 5, 10, 7)).toBe(9);
  });
  it('Home and End go to the first and last', () => {
    expect(at('Home', 9)).toBe(0);
    expect(at('End', 2)).toBe(13);
  });
  it('any other key is not the grid\'s', () => {
    expect(at('Enter', 3)).toBeNull();
    expect(at('a', 3)).toBeNull();
    expect(at('Tab', 3)).toBeNull();
  });
});

describe('stepPercent', () => {
  it('arrows step by one, pages by ten, Home and End go to 0 and 100, clamped', () => {
    expect(stepPercent('ArrowRight', 67)).toBe(68);
    expect(stepPercent('ArrowUp', 67)).toBe(68);
    expect(stepPercent('ArrowLeft', 67)).toBe(66);
    expect(stepPercent('ArrowDown', 67)).toBe(66);
    expect(stepPercent('PageUp', 67)).toBe(77);
    expect(stepPercent('PageDown', 67)).toBe(57);
    expect(stepPercent('PageUp', 95)).toBe(100);
    expect(stepPercent('ArrowLeft', 0)).toBe(0);
    expect(stepPercent('Home', 67)).toBe(0);
    expect(stepPercent('End', 67)).toBe(100);
  });
  it('any other key is not the slider\'s', () => {
    expect(stepPercent('Enter', 50)).toBeNull();
    expect(stepPercent('Tab', 50)).toBeNull();
  });
});

describe('stepArea', () => {
  it('Left and Right move saturation by one, Up and Down brightness by one, from exactly where it is', () => {
    expect(stepArea('ArrowRight', { s: 40, v: 70 })).toEqual({ s: 41, v: 70 });
    expect(stepArea('ArrowLeft', { s: 40, v: 70 })).toEqual({ s: 39, v: 70 });
    expect(stepArea('ArrowUp', { s: 40, v: 70 })).toEqual({ s: 40, v: 71 });
    expect(stepArea('ArrowDown', { s: 40, v: 70 })).toEqual({ s: 40, v: 69 });
    expect(stepArea('ArrowRight', { s: 40.4, v: 70.6 })).toEqual({ s: 41.4, v: 70.6 });
    // So a step there and back is no move at all.
    expect(stepArea('ArrowLeft', stepArea('ArrowRight', { s: 72.77, v: 83.5 })!)).toEqual({ s: 72.77, v: 83.5 });
  });
  it('with Shift, by ten; clamped to 0–100', () => {
    expect(stepArea('ArrowRight', { s: 40, v: 70 }, true)).toEqual({ s: 50, v: 70 });
    expect(stepArea('ArrowDown', { s: 40, v: 70 }, true)).toEqual({ s: 40, v: 60 });
    expect(stepArea('ArrowRight', { s: 95, v: 70 }, true)).toEqual({ s: 100, v: 70 });
    expect(stepArea('ArrowDown', { s: 40, v: 0 })).toEqual({ s: 40, v: 0 });
  });
  it('Home and End take saturation to 0 and 100; Page Up and Page Down step brightness by ten, clamped', () => {
    expect(stepArea('Home', { s: 40, v: 70 })).toEqual({ s: 0, v: 70 });
    expect(stepArea('End', { s: 40, v: 70 })).toEqual({ s: 100, v: 70 });
    expect(stepArea('PageUp', { s: 40, v: 70 })).toEqual({ s: 40, v: 80 });
    expect(stepArea('PageDown', { s: 40, v: 70 })).toEqual({ s: 40, v: 60 });
    expect(stepArea('PageUp', { s: 40, v: 95 })).toEqual({ s: 40, v: 100 });
    expect(stepArea('PageDown', { s: 40, v: 5 })).toEqual({ s: 40, v: 0 });
  });
  it('any other key is not the area\'s', () => {
    expect(stepArea('Enter', { s: 40, v: 70 })).toBeNull();
    expect(stepArea(' ', { s: 40, v: 70 })).toBeNull();
    expect(stepArea('Tab', { s: 40, v: 70 })).toBeNull();
  });
});

describe('stepHue', () => {
  it('arrows step by one degree (Shift: ten), pages by ten, from exactly where it is; Home and End go to 0 and 359; clamped', () => {
    expect(stepHue('ArrowRight', 200)).toBe(201);
    expect(stepHue('ArrowUp', 200)).toBe(201);
    expect(stepHue('ArrowLeft', 200)).toBe(199);
    expect(stepHue('ArrowDown', 200)).toBe(199);
    expect(stepHue('ArrowRight', 200, true)).toBe(210);
    expect(stepHue('PageUp', 200)).toBe(210);
    expect(stepHue('PageDown', 200)).toBe(190);
    expect(stepHue('Home', 200)).toBe(0);
    expect(stepHue('End', 200)).toBe(359);
    expect(stepHue('ArrowRight', 359)).toBe(359);
    expect(stepHue('PageDown', 4)).toBe(0);
    expect(stepHue('ArrowRight', 200.5)).toBe(201.5);
    expect(stepHue('ArrowLeft', stepHue('ArrowRight', 215.3)!)).toBeCloseTo(215.3, 10);
    expect(stepHue('ArrowRight', 358.6)).toBe(359);
  });
  it('any other key is not the strip\'s', () => {
    expect(stepHue('Enter', 200)).toBeNull();
    expect(stepHue('a', 200)).toBeNull();
  });
});
