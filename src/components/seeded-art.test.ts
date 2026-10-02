import { describe, it, expect } from 'vitest';
import { seededArt, hashSeed, rng, MUDDY_HUES } from './seeded-art';
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
