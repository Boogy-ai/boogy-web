import { describe, it, expect } from 'vitest';
import { count } from './count';

describe('count', () => {
  it('marks a count', () => {
    expect(count()).toEqual({ 'data-boogy': 'count' });
  });
});
