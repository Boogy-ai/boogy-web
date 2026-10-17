import { describe, it, expect } from 'vitest';
import { searchSelectStep, SEARCH_DELAY_MS } from './search-select';

describe('searchSelectStep', () => {
  it('Down from none is the first; Up from none is the last', () => {
    expect(searchSelectStep(-1, 5, 'ArrowDown')).toBe(0);
    expect(searchSelectStep(-1, 5, 'ArrowUp')).toBe(4);
  });
  it('moves one at a time and stops at the ends', () => {
    expect(searchSelectStep(1, 5, 'ArrowDown')).toBe(2);
    expect(searchSelectStep(4, 5, 'ArrowDown')).toBe(4);
    expect(searchSelectStep(2, 5, 'ArrowUp')).toBe(1);
    expect(searchSelectStep(0, 5, 'ArrowUp')).toBe(0);
  });
  it('with nothing listed there is nothing to be on; other keys leave it', () => {
    expect(searchSelectStep(3, 0, 'ArrowDown')).toBe(-1);
    expect(searchSelectStep(2, 5, 'a')).toBe(2);
    expect(searchSelectStep(9, 5, 'a')).toBe(4);
  });
  it('waits a moment after the last key before it searches', () => {
    expect(SEARCH_DELAY_MS).toBeGreaterThanOrEqual(150);
    expect(SEARCH_DELAY_MS).toBeLessThanOrEqual(400);
  });
});
