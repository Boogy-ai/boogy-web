import { describe, it, expect } from 'vitest';
import { boardPalette, BOARD_PALETTE_PROPS } from './board-palette';
import { hexToOklch } from '../components/color-math';

const HEX = /^#[0-9a-f]{6}$/;
const L = (hex: string) => hexToOklch(hex).l;

describe('boardPalette', () => {
  const teal = '#1e3833';
  const p = boardPalette(teal);

  it('names every property it sets, and sets nothing it does not name', () => {
    expect(Object.keys(p).sort()).toEqual([...BOARD_PALETTE_PROPS].sort());
  });

  it("the text tint leans to the board's hue, capped so text stays readable", () => {
    expect(Number(p['--hue'])).toBeCloseTo(hexToOklch(teal).h, 0);
    expect(Number(p['--tint'])).toBeLessThanOrEqual(0.03);
    expect(Number(boardPalette('#7a1f3d')['--tint'])).toBe(0.03);
  });

  it('the solid ground is the board colour; raised and frosted surfaces sit just above it', () => {
    expect(p['--ground-solid']).toBe(teal);
    expect(p['--board-ground']).toBe(teal);
    expect(p['--ground-raised']).toMatch(HEX);
    expect(L(p['--ground-raised']) - L(teal)).toBeCloseTo(0.06, 2);
    expect(L(p['--ground-frost']) - L(teal)).toBeCloseTo(0.04, 2);
    expect(p['--board-surface']).toBe(p['--ground-raised']);
  });

  it("the accent follows the board's hue at a lightness and chroma that read on the dark scheme", () => {
    const a = hexToOklch(p['--accent']);
    expect(p['--accent']).toMatch(HEX);
    expect(a.l).toBeCloseTo(0.78, 1);
    expect(a.c).toBeGreaterThan(0.08);
    expect(Math.abs(((a.h - hexToOklch(teal).h + 540) % 360) - 180)).toBeLessThan(8);
    expect(p['--board-accent']).toBe(p['--accent']);
  });

  it('a grey board has a grey accent, not a hue it does not have', () => {
    const grey = boardPalette('#2a2d33');
    expect(hexToOklch(grey['--accent']).c).toBeLessThan(0.01);
  });

  it('a field is a light translucent wash, whatever the colour', () => {
    expect(p['--board-field']).toMatch(/^color-mix\(in oklch, white \d+%, transparent\)$/);
  });

  it('near black stays a colour; anything not a #rrggbb is refused', () => {
    expect(boardPalette('#000000')['--ground-raised']).toMatch(HEX);
    expect(() => boardPalette('teal')).toThrow();
    expect(() => boardPalette('#fff')).toThrow();
  });
});

describe('boardPalette on a light board', () => {
  // A light gradient board under a pane's default 33% black: what paints there
  // is light, but the pane still renders in the dark scheme, near-white text.
  const light = '#ab965c';
  const p = boardPalette(light);
  it('its surfaces start from the colour held dark enough for light text on them', () => {
    expect(L(p['--ground-solid'])).toBeLessThanOrEqual(0.4 + 0.005);
    expect(L(p['--ground-raised'])).toBeLessThanOrEqual(0.46 + 0.005);
    expect(L(p['--ground-frost'])).toBeLessThanOrEqual(0.44 + 0.005);
    // Still its hue: the surfaces belong to the board.
    const a = hexToOklch(p['--ground-solid']), b = hexToOklch(light);
    expect(Math.abs(((a.h - b.h + 540) % 360) - 180)).toBeLessThan(6);
  });
  it('--board-ground still names the colour actually behind the pane', () => {
    expect(p['--board-ground']).toBe(light);
  });
});
