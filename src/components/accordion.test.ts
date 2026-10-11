import { describe, it, expect } from 'vitest';
import { accordion } from './accordion';

describe('accordion', () => {
  it('marks the group', () => {
    expect(accordion()).toEqual({ 'data-boogy': 'accordion' });
  });
});
