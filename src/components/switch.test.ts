import { describe, it, expect } from 'vitest';
import { switchControl } from './switch';

describe('switchControl', () => {
  it('is a button with the switch role and its state', () => {
    expect(switchControl(true)).toEqual({ 'data-boogy': 'switch', role: 'switch', type: 'button', 'aria-checked': 'true' });
    expect(switchControl(false)['aria-checked']).toBe('false');
  });
});
