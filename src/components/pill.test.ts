import { describe, it, expect } from 'vitest';
import { pill, PILL_VARIANTS } from './pill';

describe('pill', () => {
  it('is the solid variant unless told otherwise', () => {
    expect(pill()).toEqual({ 'data-boogy': 'pill', 'data-variant': 'solid' });
  });

  it('carries the variant it is given', () => {
    expect(pill({ variant: 'transparent' })['data-variant']).toBe('transparent');
  });

  it('refuses a variant it has no styles for, rather than rendering unstyled', () => {
    // @ts-expect-error — not a PillVariant
    expect(() => pill({ variant: 'outline' })).toThrow(/solid.*transparent.*ghost/);
  });

  it('lists its variants', () => {
    expect([...PILL_VARIANTS]).toEqual(['solid', 'transparent', 'ghost']);
  });
});
