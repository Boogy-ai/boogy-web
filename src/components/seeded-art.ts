// Seeded art: a few soft colour fields on a gradient, the same every time for
// the same seed and different from seed to seed. A placeholder that is
// recognisable — a cover, an avatar with no picture — without anyone drawing
// it. Pure data; <SeededArt> draws it as an SVG that fills its box.
//
// Seed it with what stays the same (an id, an address), not a display name
// that may change: the art should stay recognisable across a rename.

/** FNV-1a over UTF-16 code units. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** mulberry32: a small, fast, well-distributed PRNG — numbers in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeededArtBlob { cx: number; cy: number; r: number; color: string }
export interface SeededArtData {
  /** The gradient behind everything, from → to, along `angle` degrees. */
  from: string;
  to: string;
  angle: number;
  blobs: SeededArtBlob[];
}

/** The art's coordinate box. The SVG scales it to cover its frame. */
export const SEEDED_ART_W = 320;
export const SEEDED_ART_H = 200;

/** Hues that turn to mud (olive, brown) at a dark lightness — skipped. */
export const MUDDY_HUES = [45, 135] as const;
const MUDDY_WIDTH = MUDDY_HUES[1] - MUDDY_HUES[0];

/** A position on a wheel with the muddy band removed → a real hue. Rounded
 *  to the 0.1° it is written with BEFORE choosing a side of the band: 44.96°
 *  would otherwise be written "45.0", inside it. */
function clean(h: number): number {
  const wheel = 360 - MUDDY_WIDTH;
  const t = Math.round((((h % wheel) + wheel) % wheel) * 10) / 10;
  return t < MUDDY_HUES[0] ? t : t + MUDDY_WIDTH;
}

const oklch = (l: number, c: number, h: number) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;

/** The art for `seed`. Lightness stays in a dark band (0.30–0.50) on every
 *  colour, so white text over it keeps its contrast whatever the hues are. */
export function seededArt(seed: string): SeededArtData {
  const r = rng(hashSeed(seed));
  const base = r() * (360 - MUDDY_WIDTH);
  // Neighbouring hues, one side or the other of the base: varied, never muddy.
  const spread = (r() < 0.5 ? -1 : 1) * (30 + r() * 50);
  const hue = (k: number) => clean(base + spread * k);
  const blobs = [0, 1, 2].map((k) => ({
    cx: r() * SEEDED_ART_W,
    cy: r() * SEEDED_ART_H,
    r: SEEDED_ART_H * (0.45 + r() * 0.45),
    color: oklch(0.42 + r() * 0.08, 0.12 + r() * 0.06, hue(k)),
  }));
  return {
    from: oklch(0.3 + r() * 0.04, 0.06 + r() * 0.04, hue(0)),
    to: oklch(0.34 + r() * 0.04, 0.07 + r() * 0.04, hue(2)),
    angle: Math.round(r() * 360),
    blobs,
  };
}
