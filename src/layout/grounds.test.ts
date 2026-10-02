import { describe, it, expect } from 'vitest';
import { FOUNDATION_CSS } from './foundation-css';

const decl = (name: string) => new RegExp(`\\n\\s*${name}:\\s*([^;]+);`).exec(FOUNDATION_CSS)?.[1] ?? '';

describe('grounds', () => {
  it('the base ground is pure white in light and pure black in dark, no tint; 85% opaque in light, 40% in dark', () => {
    // Black at 85% over a dark backdrop leaves almost none of it; at 40% the
    // backdrop's colour reads. White stays at 85%: lower, over a dark
    // backdrop, would muddy the ground behind dark text.
    expect(decl('--ground')).toBe('light-dark(oklch(1 0 0 / 0.85), oklch(0 0 0 / 0.4))');
  });
  it('a solid ground is the same colour, fully opaque, for surfaces that cover content', () => {
    expect(decl('--ground-solid')).toBe('light-dark(oklch(1 0 0), oklch(0 0 0))');
  });
  it('edges are a translucent share of the ink, so they read as a dim line over whatever is behind', () => {
    // Over an opaque ground this composites close to the old opaque mix; over
    // a translucent one (a page in a frame) it takes on the colour showing
    // through, instead of drawing a near-black line across it in dark.
    expect(decl('--edge')).toBe('color-mix(in oklch, var(--text-1) 12%, transparent)');
    expect(decl('--edge-strong')).toBe('color-mix(in oklch, var(--text-1) 28%, transparent)');
  });
  it('the other grounds step the only way there is room to: down from white, up from black', () => {
    // Light: a sunken field is a step below white; raised and overlay surfaces
    // are white (they cannot go above it). Dark: sunken is black (it cannot go
    // below it); raised and overlay surfaces rise a step and two above it.
    expect(decl('--ground-sunken')).toBe('light-dark(oklch(calc(1 - var(--_step)) 0 0), oklch(0 0 0))');
    expect(decl('--ground-raised')).toBe('light-dark(oklch(1 0 0), oklch(var(--_step) 0 0))');
    expect(decl('--ground-overlay')).toBe('light-dark(oklch(1 0 0), oklch(calc(2 * var(--_step)) 0 0))');
  });
});

describe('the underline', () => {
  it('is twice a ring, from the local unit', () => {
    expect(FOUNDATION_CSS).toMatch(/--ring: calc\(var\(--u\) \* 0\.125\);\s*--underline: calc\(var\(--u\) \* 0\.25\);/);
  });
});

describe('the well', () => {
  it('a translucent sunken ground: darker than the page in both schemes, still showing what is behind', () => {
    // Light: a step below white at the page's 85%; dark: black at 60%, over a
    // page that is black at 40% — so a darker band either way.
    expect(decl('--ground-well')).toBe('light-dark(oklch(calc(1 - var(--_step)) 0 0 / 0.85), oklch(0 0 0 / 0.6))');
  });
});
