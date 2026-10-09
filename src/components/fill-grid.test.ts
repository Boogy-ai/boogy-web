import { describe, it, expect } from 'vitest';
import { fillGrid, fillGridShape } from './fill-grid';

// The grid boxes a 16:9 stage and a 9:16 phone leave after the bar, the
// question and the rules line, with the gap the stage's clamp gives each.
const WIDE = { w: 1552, h: 638, gap: 14 };
const TALL = { w: 336, h: 420, gap: 8 };
const MIN = { inline: 112, block: 44 };
const A = 1.6;

const shape = (n: number, box: { w: number; h: number; gap: number }) => {
  const s = fillGridShape(n, box.w, box.h, A, box.gap, MIN);
  return `${s.cols} × ${s.rows}${s.fallback ? ' fallback' : ''}`;
};

describe('fillGridShape', () => {
  it.each([
    [2, '2 × 1', '1 × 2'],
    [3, '3 × 1', '1 × 3'],
    [4, '2 × 2', '2 × 2'],
    [6, '3 × 2', '2 × 3'],
    [12, '4 × 3', '2 × 6'],
  ])('%i items: %s on a wide box, %s on a tall one', (n, wide, tall) => {
    expect(shape(n, WIDE)).toBe(wide);
    expect(shape(n, TALL)).toBe(tall);
  });

  it('one item fills the box', () => {
    expect(shape(1, WIDE)).toBe('1 × 1');
  });

  it('breaks a tie toward fewer empty cells (3 items: 3 × 1 over 2 × 2, both scoring 80)', () => {
    // 240 × 100, no gap: 2 × 2 cells are 120 × 50, scoring min(120, 50 × 1.6) = 80
    // with 1 empty; 3 × 1 cells are 80 × 100, scoring min(80, 100 × 1.6) = 80 with
    // none empty. Columns are tried in ascending order, so 2 × 2 is found first:
    // only the empty-cell rule picks 3 × 1.
    expect(fillGridShape(3, 240, 100, A, 0)).toEqual({ cols: 3, rows: 1, fallback: false });
  });

  it('falls back to one column when no shape meets the minimum cell', () => {
    expect(fillGridShape(12, 200, 300, A, 8, MIN)).toEqual({ cols: 1, rows: 12, fallback: true });
  });

  it('falls back on a degenerate box rather than dividing by it', () => {
    expect(fillGridShape(3, 0, 0, A, 8, MIN)).toEqual({ cols: 1, rows: 3, fallback: true });
    expect(fillGridShape(3, Number.NaN, 400, A, 8, MIN).fallback).toBe(true);
  });

  it('marks the element', () => {
    expect(fillGrid()).toEqual({ 'data-boogy': 'fill-grid' });
  });
});
