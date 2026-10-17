import { describe, it, expect } from 'vitest';
import { panel } from './panel';

describe('panel', () => {
  it('marks a panel; grow only when asked', () => {
    expect(panel()).toEqual({ 'data-boogy': 'panel' });
    expect(panel({ grow: true })).toEqual({ 'data-boogy': 'panel', 'data-grow': 'true' });
  });
});
