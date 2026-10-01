import { describe, it, expect } from 'vitest';
import { carousel, stepIndex } from './carousel';
import { button } from './button';

describe('carousel', () => {
  it('is paged only with two or more images — one image has nothing to page', () => {
    expect(carousel({ count: 1 })).toEqual({ 'data-boogy': 'carousel', 'data-paged': 'false' });
    expect(carousel({ count: 2 })['data-paged']).toBe('true');
    expect(carousel({ count: 3 })['data-paged']).toBe('true');
  });
});

describe('stepIndex', () => {
  it('steps forward and back', () => {
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, -1, 3)).toBe(1);
  });
  it('wraps round at either end', () => {
    expect(stepIndex(2, 1, 3)).toBe(0);
    expect(stepIndex(0, -1, 3)).toBe(2);
  });
  it('is 0 with nothing to step through', () => {
    expect(stepIndex(0, 1, 0)).toBe(0);
  });
});

describe('button fill', () => {
  it('is off unless asked for', () => {
    expect(button()['data-fill']).toBeUndefined();
    expect(button({ fill: true })['data-fill']).toBe('true');
  });
});
