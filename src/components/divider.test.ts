import { describe, it, expect } from 'vitest';
import { divider } from './divider';

describe('divider()', () => {
  it('a vertical rule by default: between groups of controls in a bar', () => {
    expect(divider()).toEqual({ 'data-boogy': 'divider', role: 'separator', 'aria-orientation': 'vertical' });
  });
  it('horizontal: between groups stacked in a column', () => {
    expect(divider({ orientation: 'horizontal' })).toEqual({ 'data-boogy': 'divider', role: 'separator', 'aria-orientation': 'horizontal' });
  });
});
