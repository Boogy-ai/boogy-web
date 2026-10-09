import { describe, it, expect } from 'vitest';
import { choiceGroup } from './choice-group';

describe('choiceGroup', () => {
  it('marks the group', () => {
    expect(choiceGroup()).toEqual({ 'data-boogy': 'choice-group' });
  });
});
