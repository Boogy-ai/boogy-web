import { describe, it, expect } from 'vitest';
import { metaLine } from './meta';

describe('metaLine', () => {
  it('joins the parts it has with a middle dot, and nothing else', () => {
    expect(metaLine(['dave', 'messaging', 'v1'])).toBe('dave · messaging · v1');
    expect(metaLine(['dave', undefined, '', null, false, 'v1'])).toBe('dave · v1');
    expect(metaLine([undefined, ''])).toBe('');
  });
  it('trims, so a blank part is no part', () => {
    expect(metaLine([' dave ', '  '])).toBe('dave');
  });
});
