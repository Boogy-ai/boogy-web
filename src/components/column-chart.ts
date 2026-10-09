// ColumnChart: an ordered series of columns, each a stack of segments (the
// same segments as Meter), with first and last axis labels. A visually hidden
// table holds every value for a screen reader.

import { segmentShares, segmentTotal, type Segment } from './segments';

export interface ChartColumn {
  label: string;
  segments: readonly Segment[];
}

export interface ColumnChartAttrs {
  'data-boogy': 'column-chart';
}

export function columnChart(): ColumnChartAttrs {
  return { 'data-boogy': 'column-chart' };
}

/** Every segment's height as a percentage of the tallest column (less `gaps`
 *  gaps between segments, which the caller takes off the height). The scaling
 *  is Meter's: a negative or non-finite value draws as 0, and an all-empty
 *  series draws nothing rather than dividing by zero. */
export function columnHeights(columns: readonly ChartColumn[]): { max: number; heights: number[][]; gaps: number } {
  const max = columns.reduce((m, c) => Math.max(m, segmentTotal(c.segments)), 0);
  const heights = columns.map((c) => segmentShares(c.segments, max));
  // The most gaps any column draws between its visible segments: the height
  // they take is not the data's, so the heights above are shares of what is
  // left. Every column then stands on one scale and none overflows the chart,
  // a near-tallest column with more segments included; the tallest fills it
  // exactly when no column draws more gaps than it does.
  const gaps = heights.reduce((g, h) => Math.max(g, h.filter((x) => x > 0).length - 1), 0);
  return { max, heights, gaps };
}

/** The values as a table: one heading per segment any column holds, in the
 *  order first seen, and one row per column. Segments are told apart by label,
 *  and a label a column holds twice is two headings, as the chart draws two
 *  segments: the table never sums. A column without a segment holds 0 there;
 *  values read as Meter reads them (a negative or non-finite value is 0). */
export function columnTable(columns: readonly ChartColumn[]): { kinds: string[]; rows: number[][] } {
  /** Each segment's heading: its label, and which of that label in its column. */
  const keyed = columns.map((c) => {
    const seen = new Map<string, number>();
    return c.segments.map((s) => {
      const n = seen.get(s.label) ?? 0;
      seen.set(s.label, n + 1);
      return { key: `${n} ${s.label}`, label: s.label, value: segmentTotal([s]) };
    });
  });
  const headings = new Map<string, string>();
  for (const col of keyed) for (const s of col) if (!headings.has(s.key)) headings.set(s.key, s.label);
  const keys = [...headings.keys()];
  const rows = keyed.map((col) => keys.map((k) => col.find((s) => s.key === k)?.value ?? 0));
  return { kinds: [...headings.values()], rows };
}
