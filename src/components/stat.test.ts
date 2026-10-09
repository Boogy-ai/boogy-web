import { describe, it, expect } from 'vitest';
import { stat } from './stat';

describe('stat', () => {
  it('marks the element', () => {
    expect(stat()).toEqual({ 'data-boogy': 'stat' });
  });
});
