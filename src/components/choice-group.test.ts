import { describe, it, expect } from 'vitest';
import { choiceGroup } from './choice-group';

describe('choiceGroup', () => {
  it('marks the group', () => {
    expect(choiceGroup()).toEqual({ 'data-boogy': 'choice-group' });
  });

  it('a segmented group says so, and fills its width only when asked', () => {
    expect(choiceGroup({ variant: 'segmented' })).toEqual({ 'data-boogy': 'choice-group', 'data-variant': 'segmented' });
    expect(choiceGroup({ variant: 'segmented', fill: true })).toEqual({ 'data-boogy': 'choice-group', 'data-variant': 'segmented', 'data-fill': 'true' });
    expect(choiceGroup({ variant: 'list' })).toEqual({ 'data-boogy': 'choice-group' });
  });

  it('refuses a variant it does not know', () => {
    expect(() => choiceGroup({ variant: 'pills' as never })).toThrow(/variant/);
  });
});
