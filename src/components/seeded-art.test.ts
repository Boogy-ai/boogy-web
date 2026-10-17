import { describe, it, expect } from 'vitest';
import { seededArt, seededFlat, SEEDED_FLAT_COLOURS, hashSeed, rng, MUDDY_HUES } from './seeded-art';
import { toneOf, THUMBNAIL_TONES } from './thumbnail';

const colours = (seed: string) => {
  const a = seededArt(seed);
  return [a.from, a.to, ...a.blobs.map((b) => b.color)];
};

describe('seededArt', () => {
  it('the same seed always gets the same art', () => {
    expect(seededArt('alice')).toEqual(seededArt('alice'));
  });
  it('different seeds get different art', () => {
    const seeds = ['tester/wordle', 'tester/tictactoe', 'tester/boards', 'dave/polls', 'carol/chat', 'carol/links'];
    expect(new Set(seeds.map((s) => seededArt(s).from)).size).toBe(seeds.length);
  });
  it('every colour stays in the dark band, so white text over it keeps its contrast', () => {
    for (let i = 0; i < 500; i++) {
      for (const c of colours(`seed-${i}`)) {
        const l = Number(/^oklch\(([\d.]+) /.exec(c)![1]);
        expect(l >= 0.3 && l <= 0.5, `${c} lightness out of band`).toBe(true);
      }
    }
  });
  it('no colour falls in the muddy band (olive and brown at a dark lightness)', () => {
    for (let i = 0; i < 500; i++) {
      for (const c of colours(`seed-${i}`)) {
        const h = Number(/ ([\d.]+)\)$/.exec(c)![1]);
        expect(h < MUDDY_HUES[0] || h >= MUDDY_HUES[1], `${c} is in the muddy band`).toBe(true);
      }
    }
  });
  it('the PRNG is deterministic and stays in [0, 1)', () => {
    const a = rng(hashSeed('x')), b = rng(hashSeed('x'));
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v >= 0 && v < 1).toBe(true);
    }
  });
  it("a thumbnail's tone is the same hash", () => {
    for (const label of ['Squad Chats', 'Wallet', 'ada', '']) expect(toneOf(label)).toBe(hashSeed(label) % THUMBNAIL_TONES);
  });
});

const parts = (c: string) => /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(c)!.slice(1).map(Number);

describe('seededFlat', () => {
  const circular = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  it('the same seed always gets the same colour', () => {
    expect(seededFlat('general')).toEqual(seededFlat('general'));
  });
  it('one of a few colours with hues far apart: two are the same or plainly different, never two near blues', () => {
    const hues = SEEDED_FLAT_COLOURS.map((c) => parts(c.fill)[2]);
    expect(hues.length).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) expect(circular(hues[i], hues[j])).toBeGreaterThanOrEqual(35);
    const fills = SEEDED_FLAT_COLOURS.map((c) => c.fill);
    for (const seed of ['general', 'design', 'scale-check', 'x', '']) expect(fills).toContain(seededFlat(seed).fill);
  });
  it('seeds spread over every colour', () => {
    const used = new Set(Array.from({ length: 400 }, (_, i) => seededFlat(`room-${i}`).fill));
    expect(used.size).toBe(SEEDED_FLAT_COLOURS.length);
  });
  it('general and scale-check, two rooms that were both blue, differ', () => {
    expect(circular(parts(seededFlat('general').fill)[2], parts(seededFlat('scale-check').fill)[2])).toBeGreaterThanOrEqual(35);
  });
  it('each is bright, its ink a deep shade of the same hue', () => {
    for (const { fill, ink } of SEEDED_FLAT_COLOURS) {
      const [fl, fc, fh] = parts(fill);
      const [il, , ih] = parts(ink);
      expect(fl).toBeGreaterThanOrEqual(0.7);
      expect(fc).toBeGreaterThanOrEqual(0.1);
      expect(il).toBeLessThanOrEqual(0.3);
      expect(ih).toBe(fh);
    }
  });
});
