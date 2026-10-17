import { describe, it, expect } from 'vitest';
import { formatNumber, numericValue, NUMERIC_VARIANTS } from './numeric-value';
import { ruleFor } from '../../test-support/rule-for';

describe('formatNumber', () => {
  it('grouped (the default): the locale\'s own grouping and decimal marks', () => {
    expect(formatNumber(4200, { locale: 'en-US' })).toBe('4,200');
    expect(formatNumber(4200, { locale: 'de-DE' })).toBe('4.200');
    expect(formatNumber(1234567.5, { locale: 'en-US' })).toBe('1,234,567.5');
    expect(formatNumber(1234567.5, { locale: 'de-DE' })).toBe('1.234.567,5');
  });
  it('compact: abbreviated the way the locale abbreviates', () => {
    expect(formatNumber(4200, { variant: 'compact', locale: 'en-US' })).toBe('4.2K');
    expect(formatNumber(4_200_000, { variant: 'compact', locale: 'en-US' })).toBe('4.2M');
    expect(formatNumber(42, { variant: 'compact', locale: 'en-US' })).toBe('42');
    expect(formatNumber(4_200_000, { variant: 'compact', locale: 'de-DE' })).toBe('4,2 Mio.');
  });
  it('decimals fixes the places shown, zeros included', () => {
    expect(formatNumber(4, { decimals: 2, locale: 'en-US' })).toBe('4.00');
    expect(formatNumber(4.5, { decimals: 2, locale: 'en-US' })).toBe('4.50');
    expect(formatNumber(4200, { variant: 'compact', decimals: 2, locale: 'en-US' })).toBe('4.20K');
  });
  it('trimZeros drops the decimals only when every one of them is zero, and is off by default', () => {
    expect(formatNumber(4, { decimals: 2, trimZeros: true, locale: 'en-US' })).toBe('4');
    expect(formatNumber(4.5, { decimals: 2, trimZeros: true, locale: 'en-US' })).toBe('4.50');
    expect(formatNumber(3.999, { decimals: 2, trimZeros: true, locale: 'en-US' })).toBe('4');
    expect(formatNumber(4000, { variant: 'compact', decimals: 1, trimZeros: true, locale: 'en-US' })).toBe('4K');
    expect(formatNumber(4200, { variant: 'compact', decimals: 1, trimZeros: true, locale: 'en-US' })).toBe('4.2K');
  });
  it('refuses a variant it does not have', () => {
    expect(NUMERIC_VARIANTS).toEqual(['grouped', 'compact']);
    expect(() => formatNumber(1, { variant: 'short' as never })).toThrow(/variant/);
  });
});

describe('numericValue', () => {
  it('marks the value and its variant', () => {
    expect(numericValue()).toEqual({ 'data-boogy': 'numeric-value', 'data-variant': 'grouped' });
    expect(numericValue({ variant: 'compact' })).toEqual({ 'data-boogy': 'numeric-value', 'data-variant': 'compact' });
  });
  it('sets its digits at one width, so a changing count does not jitter', () => {
    expect(ruleFor('[data-boogy="numeric-value"]')).toContain('font-variant-numeric: tabular-nums');
  });
});
