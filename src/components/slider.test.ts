import { describe, it, expect } from 'vitest';
import { clampSlider, sliderControl, stepSlider } from './slider';

describe('sliderControl', () => {
  it('names the slider', () => {
    expect(sliderControl()).toEqual({ 'data-boogy': 'slider' });
  });
});

describe('clampSlider', () => {
  it('holds a value inside the range, on a step', () => {
    const r = { min: -180, max: 180, step: 1 };
    expect(clampSlider(200, r)).toBe(180);
    expect(clampSlider(-181, r)).toBe(-180);
    expect(clampSlider(12.4, r)).toBe(12);
    expect(clampSlider(13, { min: 0, max: 100, step: 5 })).toBe(15);
    expect(clampSlider(Number.NaN, r)).toBe(-180);
  });
});

describe('stepSlider', () => {
  const r = { min: -180, max: 180, step: 1 };
  it('arrows step by one step, Page Up and Page Down by ten, Home and End go to the ends', () => {
    expect(stepSlider('ArrowRight', 0, r)).toBe(1);
    expect(stepSlider('ArrowUp', 0, r)).toBe(1);
    expect(stepSlider('ArrowLeft', 0, r)).toBe(-1);
    expect(stepSlider('ArrowDown', 0, r)).toBe(-1);
    expect(stepSlider('PageUp', 0, r)).toBe(10);
    expect(stepSlider('PageDown', 0, r)).toBe(-10);
    expect(stepSlider('Home', 0, r)).toBe(-180);
    expect(stepSlider('End', 0, r)).toBe(180);
    expect(stepSlider('PageUp', 0, { min: 0, max: 200, step: 5 })).toBe(50);
  });
  it('stops at the ends', () => {
    expect(stepSlider('ArrowRight', 180, r)).toBe(180);
    expect(stepSlider('PageDown', -175, r)).toBe(-180);
  });
  it('is null for a key it does not handle', () => {
    expect(stepSlider('Tab', 0, r)).toBeNull();
    expect(stepSlider('a', 0, r)).toBeNull();
  });
});
