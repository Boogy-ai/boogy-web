// Count: a number beside a label (a tab's, a choice's), drawn as a small badge
// of its own so it never reads as part of the label. Compact (10K), with the
// exact, grouped value as its title.

export interface CountAttrs {
  'data-boogy': 'count';
}

export function count(): CountAttrs {
  return { 'data-boogy': 'count' };
}
