// Meter: a horizontal bar of stacked segments with an accessible value: the
// total against its max, and every segment in words.

export interface MeterAttrs {
  'data-boogy': 'meter';
  role: 'meter';
  'aria-valuemin': '0';
  'aria-valuemax': string;
  'aria-valuenow': string;
  'aria-valuetext': string;
}

export function meter({ value, max, text }: { value: number; max: number; text: string }): MeterAttrs {
  const top = Number.isFinite(max) && max > 0 ? max : 0;
  return {
    'data-boogy': 'meter',
    role: 'meter',
    'aria-valuemin': '0',
    'aria-valuemax': String(top),
    'aria-valuenow': String(Math.min(Number.isFinite(value) ? Math.max(0, value) : 0, top)),
    'aria-valuetext': text,
  };
}
