// Stack: children in a column, or in a row that wraps, a space token apart.
// It owns the spacing between its children, so they bring no margins of their
// own — the one layout decision most compositions otherwise make inline.

export const STACK_GAPS = [1, 2, 3, 4] as const;
export type StackGap = (typeof STACK_GAPS)[number];
export type StackDirection = 'column' | 'row';

export interface StackAttrs {
  'data-boogy': 'stack';
  'data-direction': StackDirection;
  'data-gap': string;
}

export function stack(opts: { direction?: StackDirection; gap?: StackGap } = {}): StackAttrs {
  const gap = opts.gap ?? 2;
  if (!STACK_GAPS.includes(gap)) {
    throw new Error(`stack(): gap must be one of ${STACK_GAPS.join(', ')}, got ${gap}`);
  }
  return { 'data-boogy': 'stack', 'data-direction': opts.direction ?? 'column', 'data-gap': String(gap) };
}
