import { describe, it, expect } from 'vitest';
import { swatch } from './swatch';

describe('swatch', () => {
  it('marks the element, hidden from assistive tech (its label names the colour)', () => {
    expect(swatch()).toEqual({ 'data-boogy': 'swatch', 'aria-hidden': 'true' });
  });
});
