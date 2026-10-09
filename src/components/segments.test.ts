import { describe, it, expect } from 'vitest';
import { segmentShares, segmentText, segmentTotal, type Segment } from './segments';

const s = (value: number, label: string): Segment => ({ value, label, color: 'var(--c)' });

describe('segments', () => {
  it('totals and shares against a max, in order', () => {
    const segs = [s(12, 'signed in'), s(4, 'by invite')];
    expect(segmentTotal(segs)).toBe(16);
    expect(segmentShares(segs, 20)).toEqual([60, 20]);
  });

  it('reads a negative or non-finite value as 0, and a zero max as all-empty', () => {
    expect(segmentShares([s(-3, 'a'), s(Number.NaN, 'b'), s(5, 'c')], 10)).toEqual([0, 0, 50]);
    expect(segmentShares([s(5, 'a')], 0)).toEqual([0]);
  });

  it('never exceeds 100 in total when values exceed the max', () => {
    const shares = segmentShares([s(8, 'a'), s(8, 'b')], 10);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });

  it('says every segment in words, for the accessible value', () => {
    expect(segmentText([s(12, 'signed in'), s(4, 'by invite')])).toBe('12 signed in, 4 by invite');
  });
});
