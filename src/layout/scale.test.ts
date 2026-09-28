import { describe, it, expect } from 'vitest';
import { scale, surface, withScale, DEFAULT_SCALE } from './scale';

describe('scale', () => {
  it('defaults to the safe axis and policy', () => {
    const a = scale();
    expect(a['data-u-axis']).toBe('min');
    expect(a['data-u-policy']).toBe('clamped');
    expect(a.style).toEqual({ '--u-factor': '4', '--u-floor': '0.625rem', '--u-cap': '1.0625rem' });
  });

  it('carries every axis through', () => {
    for (const axis of ['inline', 'block', 'min', 'max', 'diagonal'] as const) {
      expect(scale({ axis })['data-u-axis']).toBe(axis);
    }
  });

  it('names the component when asked, and only then', () => {
    expect(scale({ component: 'PaneBar' })['data-component']).toBe('PaneBar');
    expect('data-component' in scale()).toBe(false);
  });

  it('refuses a factor that is not a positive finite number', () => {
    for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => scale({ factor })).toThrow(/factor/);
    }
  });

  it('refuses a floor or cap that is not a rem length', () => {
    expect(() => scale({ floor: '10px' })).toThrow(/rem/);
    expect(() => scale({ cap: 'large' })).toThrow(/rem/);
  });

  it('refuses a floor above the cap', () => {
    expect(() => scale({ floor: '2rem', cap: '1rem' })).toThrow(/floor/);
  });

  it('lets an override win field by field', () => {
    const base = { axis: 'block', factor: 3 } as const;
    expect(withScale(base, { factor: 5 })).toEqual({ axis: 'block', factor: 5 });
    expect(withScale(base)).toEqual(base);
  });

  it('exposes the defaults it applies', () => {
    expect(DEFAULT_SCALE.axis).toBe('min');
  });
});

describe('surface', () => {
  it('defaults to inline-size containment, never the collapsing kind', () => {
    expect(surface()).toEqual({ 'data-surface': 'inline' });
  });

  it('opts into both-axis containment explicitly', () => {
    expect(surface('both')).toEqual({ 'data-surface': 'both' });
  });
});
