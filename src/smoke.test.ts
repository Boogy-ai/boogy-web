import { describe, it, expect } from 'vitest';
import { BoogyError } from './errors';

describe('scaffold', () => {
  it('BoogyError carries a discriminable code', () => {
    const e = new BoogyError('popup_blocked', 'blocked');
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('popup_blocked');
  });
});
