// Segments: the parts of one stacked bar (a Meter, or a column of a
// ColumnChart). Each is a value, a token colour, a label for the words a
// screen reader hears, and a pattern: solid, or stripes, so that two segments
// of one hue still read apart without colour vision.

export type SegmentPattern = 'solid' | 'stripes';

export interface Segment {
  value: number;
  /** Any CSS colour, typically a `var(--token)`. */
  color: string;
  /** What one unit of this segment is, e.g. "signed in". */
  label: string;
  pattern?: SegmentPattern;
}

const clean = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

export function segmentTotal(segments: readonly Segment[]): number {
  return segments.reduce((sum, s) => sum + clean(s.value), 0);
}

/** Each segment's share of `max`, as a percentage. In total they never
 *  exceed 100. A `max` of 0 (or less) is an empty range: every share is 0, so
 *  the bar is drawn empty, while `segmentText` still states each count. */
export function segmentShares(segments: readonly Segment[], max: number): number[] {
  const top = clean(max);
  if (top === 0) return segments.map(() => 0);
  const scale = Math.max(top, segmentTotal(segments));
  return segments.map((s) => (clean(s.value) / scale) * 100);
}

export function segmentText(segments: readonly Segment[]): string {
  return segments.map((s) => `${clean(s.value)} ${s.label}`).join(', ');
}
