import { describe, it, expect } from 'vitest';
import { FOUNDATION_CSS } from './foundation-css';
import { COMPONENTS_CSS } from '../components/components-css';

const token = (name: string) => FOUNDATION_CSS.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1];

describe('shadow tokens (HeroUI v3 roles)', () => {
  it('defines surface, overlay, field, bar, menu and avatar shadows, each for light and dark', () => {
    for (const name of ['--surface-shadow', '--overlay-shadow', '--field-shadow', '--bar-shadow', '--menu-shadow', '--avatar-shadow']) {
      expect(token(name), name).toMatch(/light-dark\(/);
    }
  });
  it('dark keeps an overlay\'s lift, and drops surface and field shadows as HeroUI does', () => {
    expect(token('--overlay-shadow')).toMatch(/light-dark\([^,]+,\s*rgb\(0 0 0 \/ 0\.\d+\)\)/);
    expect(token('--surface-shadow')).toMatch(/light-dark\([^,]+,\s*transparent\)/);
    expect(token('--field-shadow')).toMatch(/light-dark\([^,]+,\s*transparent\)/);
  });
  it("a bar's shadow, asked for, shows in dark as in light: it is the bar's edge over what scrolls", () => {
    expect(token('--bar-shadow')).toMatch(/light-dark\([^,]+,\s*rgb\(0 0 0 \/ 0\.\d+\)\)/);
  });
  it("an avatar's shadow is small, and shows in dark as in light", () => {
    const avatar = token('--avatar-shadow')!;
    expect(avatar).toMatch(/light-dark\([^,]+,\s*rgb\(0 0 0 \/ 0\.\d+\)\)/);
    const layers = [...avatar.matchAll(/0 (\d+)px (\d+)px/g)].map(([, y, blur]) => [Number(y), Number(blur)]);
    for (const [, blur] of layers) expect(blur).toBeLessThanOrEqual(6);
    // Cast well below it: its larger layer drops at least 4px.
    expect(Math.max(...layers.map(([y]) => y))).toBeGreaterThanOrEqual(4);
    // Translucent: no layer darker than a quarter, in either scheme.
    for (const [, alpha] of avatar.matchAll(/\/ (0\.\d+)\)/g)) expect(Number(alpha)).toBeLessThanOrEqual(0.25);
  });
  it('an avatar casts it', () => {
    expect(COMPONENTS_CSS).toMatch(/\[data-boogy="avatar"\] \{[^}]*box-shadow:\s*var\(--avatar-shadow\)/);
  });
  it("a frosted menu's shadow is small, and shows in dark as in light", () => {
    const menu = token('--menu-shadow')!;
    expect(menu).toMatch(/light-dark\([^,]+,\s*rgb\(0 0 0 \/ 0\.\d+\)\)/);
    // Small: no layer blurs further than 8px (the raised popover's reaches 24px).
    for (const [, blur] of menu.matchAll(/0 \d+px (\d+)px/g)) expect(Number(blur)).toBeLessThanOrEqual(8);
  });
});

describe('components use the shadow tokens', () => {
  const code = COMPONENTS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  /** A ring, not a lift: every layer spread only (`[inset] 0 0 0 <size> <colour>`),
   *  no offset and no blur, its size and colour tokens. An edge drawn inside or
   *  around a box. */
  const SIZE = String.raw`(?:var\(--[\w-]+\)|calc\([^()]*(?:\([^()]*\)[^()]*)*\))`;
  const RING_LAYER = new RegExp(`^(?:inset )?0 0 0 ${SIZE} var\\(--[\\w-]+\\)$`);
  const isRing = (value: string) => value.split(/,(?![^(]*\))/).every((layer) => RING_LAYER.test(layer.trim()));
  it('a ring is told from a lift', () => {
    expect(isRing('inset 0 0 0 var(--ring) var(--text-1), inset 0 0 0 calc(2 * var(--ring)) var(--ground-solid)')).toBe(true);
    expect(isRing('0 0 0 var(--hairline) var(--text-1)')).toBe(true);
    expect(isRing('0 2px 4px 0 var(--edge)')).toBe(false);
    expect(isRing('0 0 4px var(--edge)')).toBe(false);
    expect(isRing('inset 0 0 0 var(--ring) var(--text-1), 0 4px 16px 0 rgb(0 0 0 / 0.2)')).toBe(false);
  });
  it('every box-shadow in a component is a role token, none, or a ring', () => {
    const shadows = [...code.matchAll(/box-shadow:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(shadows.length).toBeGreaterThan(0);
    for (const s of shadows) {
      // A ring kept as a token (`var(--x-ring)`) is checked by its definition.
      const named = /^var\((--[\w-]+-ring)\)$/.exec(s);
      const value = named ? code.match(new RegExp(`${named[1]}:\\s*([^;]+);`))?.[1]?.trim() ?? '' : s;
      expect(/^(none|var\(--(surface|overlay|field|bar|menu|avatar)-shadow\))$/.test(s) || isRing(value), s).toBe(true);
    }
  });
  it('the popover and the overlaid drawer float on --overlay-shadow', () => {
    expect(code).toMatch(/\[data-boogy="popover"\] \{[^}]*box-shadow:\s*var\(--overlay-shadow\)/);
    expect(code).toMatch(/\[data-boogy="drawer"\] \{[^}]*box-shadow:\s*var\(--overlay-shadow\)/);
  });
});
