import { describe, it, expect } from 'vitest';
import { columnChart, columnHeights, columnTable } from './column-chart';

const seg = (value: number, pattern?: 'stripes') => ({ value, color: 'var(--c)', label: 'x', pattern });

describe('columnHeights', () => {
  it('scales every segment against the tallest column, in percent', () => {
    const { max, heights } = columnHeights([
      { label: 'a', segments: [seg(2), seg(2, 'stripes')] },
      { label: 'b', segments: [seg(8), seg(0, 'stripes')] },
      { label: 'c', segments: [seg(0), seg(0, 'stripes')] },
    ]);
    expect(max).toBe(8);
    expect(heights).toEqual([[25, 25], [100, 0], [0, 0]]);
  });

  it('draws nothing, rather than dividing by zero, for an all-empty series', () => {
    expect(columnHeights([{ label: 'a', segments: [seg(0)] }])).toEqual({ max: 0, heights: [[0]], gaps: 0 });
  });

  it('counts the most gaps any column draws between its visible segments, not the tallest column\'s alone', () => {
    const cols = [
      { label: 'a', segments: [seg(2), seg(0), seg(2)] },
      { label: 'b', segments: [seg(1), seg(1), seg(1)] },
    ];
    // The tallest (a) draws one gap; b, shorter, draws two. Taking only the
    // tallest's would leave b's second gap to push it past the chart.
    expect(columnHeights(cols).gaps).toBe(2);
    expect(columnHeights([{ label: 'a', segments: [seg(10)] }, { label: 'b', segments: [seg(3), seg(3), seg(3.9)] }]).gaps).toBe(2);
    expect(columnHeights([{ label: 'a', segments: [seg(0)] }]).gaps).toBe(0);
  });

  it('marks the element', () => {
    expect(columnChart()).toEqual({ 'data-boogy': 'column-chart' });
  });
});

describe('columnTable', () => {
  it('heads the table with every segment label in first-seen order, and fills a column without one with 0', () => {
    const at = (label: string, value: number) => ({ value, color: 'var(--c)', label });
    expect(columnTable([
      { label: 'a', segments: [at('x', 1)] },
      { label: 'b', segments: [at('y', 2), at('x', 3)] },
      { label: 'c', segments: [at('z', 4)] },
    ])).toEqual({ kinds: ['x', 'y', 'z'], rows: [[1, 0, 0], [3, 2, 0], [0, 0, 4]] });
  });

  it('never sums: a label a column holds twice is two headings, as the chart draws two segments', () => {
    const at = (label: string, value: number) => ({ value, color: 'var(--c)', label });
    expect(columnTable([
      { label: 'a', segments: [at('x', 1), at('y', 2), at('x', 3)] },
      { label: 'b', segments: [at('x', 4)] },
    ])).toEqual({ kinds: ['x', 'y', 'x'], rows: [[1, 2, 3], [4, 0, 0]] });
  });
});
