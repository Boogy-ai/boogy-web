// Stat: a headline number with its label, and an optional caption beneath.
// The number is fitted to its box (FitText), so a dashboard's top line scales
// with the frame.

export interface StatAttrs {
  'data-boogy': 'stat';
}

export function stat(): StatAttrs {
  return { 'data-boogy': 'stat' };
}
