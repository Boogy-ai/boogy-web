import { describe, it, expect } from 'vitest';
import { splitView } from './split-view';

describe('splitView', () => {
  it('marks the layout and the width below which it is tabs (md by default)', () => {
    expect(splitView()).toEqual({ 'data-boogy': 'split-view', 'data-collapse-at': 'md' });
    expect(splitView({ collapseAt: 'lg' })).toEqual({ 'data-boogy': 'split-view', 'data-collapse-at': 'lg' });
  });
  it('refuses a width it does not know', () => {
    expect(() => splitView({ collapseAt: 'xl' as never })).toThrow(/collapseAt/);
  });
});
