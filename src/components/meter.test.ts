import { describe, it, expect } from 'vitest';
import { meter } from './meter';

describe('meter', () => {
  it('is a meter with its value, range and words', () => {
    expect(meter({ value: 16, max: 20, text: '12 signed in, 4 by invite' })).toEqual({
      'data-boogy': 'meter',
      role: 'meter',
      'aria-valuemin': '0',
      'aria-valuemax': '20',
      'aria-valuenow': '16',
      'aria-valuetext': '12 signed in, 4 by invite',
    });
  });

  it('keeps the value inside its range', () => {
    expect(meter({ value: 30, max: 20, text: '' })['aria-valuenow']).toBe('20');
    expect(meter({ value: 0, max: 0, text: '' })['aria-valuemax']).toBe('0');
  });

  it('reads a non-finite or negative max as 0', () => {
    for (const max of [Number.NaN, Number.POSITIVE_INFINITY, -4]) {
      const a = meter({ value: 3, max, text: '' });
      expect([a['aria-valuemax'], a['aria-valuenow']]).toEqual(['0', '0']);
    }
  });
});
