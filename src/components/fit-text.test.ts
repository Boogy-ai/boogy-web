import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { FIT_ROUNDS, attachFitText, fitNext, fitProbe, fitResult, fitStart, fitText, fitTextVars } from './fit-text';
import { flushRounds, runRounds, setFrameScheduler, type RoundJob } from './measure';
import { clearHostZoom, setHostZoom } from '../layout/zoom';

/** Run the fit against a box where `fitsAt(f)` says whether factor f fits. */
function fit(fitsAt: (f: number) => boolean): { result: number; probes: number[] } {
  let s = fitStart();
  const probes: number[] = [];
  while (!s.done) {
    const p = fitProbe(s);
    probes.push(p);
    s = fitNext(s, fitsAt(p));
  }
  return { result: fitResult(s), probes };
}

describe('fitText', () => {
  it('marks the element', () => {
    expect(fitText()).toEqual({ 'data-boogy': 'fit-text' });
  });

  it('carries its two bounds as custom properties, any CSS length', () => {
    expect(fitTextVars('clamp(1rem, 3cqmin, 2rem)', '9rem')).toEqual({
      '--fit-min': 'clamp(1rem, 3cqmin, 2rem)',
      '--fit-max': '9rem',
    });
  });

  it('keeps the maximum when the text fits at it, after one probe', () => {
    expect(fit(() => true)).toEqual({ result: 1, probes: [1] });
  });

  it('falls to the minimum when nothing fits', () => {
    expect(fit(() => false).result).toBe(0);
  });

  it('finds the largest fitting factor within 1/128 in FIT_ROUNDS probes, never above it', () => {
    const { result, probes } = fit((f) => f <= 0.37);
    expect(probes).toHaveLength(FIT_ROUNDS);
    expect(result).toBeLessThanOrEqual(0.37);
    expect(0.37 - result).toBeLessThan(1 / 128);
  });
});

/** A happy-dom element whose layout is simulated: its text fits while the
 *  factor on --fit is at most `fitsUpTo` (read at each measurement, so a
 *  function can move the layout mid-fit). When it does not fit, its box shows
 *  `boxPx` of a `linePx` line height. */
function fakeText(fitsUpTo: number | (() => number), boxPx = 100, linePx = 20): HTMLElement {
  const el = document.createElement('div');
  el.style.lineHeight = `${linePx}px`;
  const fit = () => Number.parseFloat(el.style.getPropertyValue('--fit') || '1');
  const limit = typeof fitsUpTo === 'function' ? fitsUpTo : () => fitsUpTo;
  Object.defineProperty(el, 'clientHeight', { get: () => boxPx });
  Object.defineProperty(el, 'scrollHeight', { get: () => (fit() <= limit() ? boxPx : boxPx * 3) });
  Object.defineProperty(el, 'clientWidth', { get: () => 300 });
  Object.defineProperty(el, 'scrollWidth', { get: () => 300 });
  document.body.append(el);
  return el;
}

describe('attachFitText', () => {
  let restore: ((run: () => void) => void) | null = null;
  beforeEach(() => { restore = setFrameScheduler(() => {}); });
  afterEach(() => { if (restore) setFrameScheduler(restore); document.body.replaceChildren(); });
  const factor = (el: HTMLElement) => Number.parseFloat(el.style.getPropertyValue('--fit'));

  it('fits a group at one shared size: the largest at which every member fits', () => {
    const a = fakeText(0.6), b = fakeText(0.3);
    attachFitText(a, { group: 'g1' });
    attachFitText(b, { group: 'g1' });
    flushRounds();
    expect(factor(a)).toBe(factor(b));
    expect(factor(b)).toBeLessThanOrEqual(0.3);
    expect(0.3 - factor(b)).toBeLessThan(1 / 128);
  });

  it('a text alone keeps its own size', () => {
    const a = fakeText(0.6);
    attachFitText(a);
    flushRounds();
    expect(0.6 - factor(a)).toBeLessThan(1 / 128);
    expect(a.dataset.overflow).toBe('false');
  });

  it('says when even the smallest size overflows, and how many whole lines its box shows', () => {
    const fits = fakeText(1), over = fakeText(-1, 50, 20);
    attachFitText(fits, { group: 'g2' });
    attachFitText(over, { group: 'g2' });
    flushRounds();
    expect(over.dataset.overflow).toBe('true');
    expect(over.style.getPropertyValue('--fit-lines')).toBe('2');
    expect(fits.dataset.overflow).toBe('false');
    expect(fits.style.getPropertyValue('--fit-lines')).toBe('');
  });

  it('a text the layout moved under while it was measured is fitted again, to the box it ends with, not left on an ellipsis', () => {
    // A neighbour measured in the same batch (a fitted heading above a grid)
    // ends at a size that shrinks this text's box: until it finishes the text
    // fits up to 0.6, after it only up to 0.3.
    let limit = 0.6;
    const label = fakeText(() => limit);
    let left = 3;
    const neighbour: RoundJob = {
      start: () => { left = 3; },
      write: () => {},
      read: () => (left -= 1) === 0,
      finish: () => { limit = 0.3; },
    };
    attachFitText(label);
    runRounds(neighbour);
    flushRounds();
    flushRounds();
    expect(factor(label)).toBeLessThanOrEqual(0.3);
    expect(0.3 - factor(label)).toBeLessThan(1 / 128);
    expect(label.dataset.overflow).toBe('false');
    expect(label.style.getPropertyValue('--fit-lines')).toBe('');
  });

  it('a text the layout moved under is not left smaller than the box it ends with allows', () => {
    // The other way round: until the neighbour finishes, the text fits up to
    // 0.3; after, up to 0.6.
    let limit = 0.3;
    const label = fakeText(() => limit);
    let left = 3;
    const neighbour: RoundJob = {
      start: () => { left = 3; },
      write: () => {},
      read: () => (left -= 1) === 0,
      finish: () => { limit = 0.6; },
    };
    attachFitText(label);
    runRounds(neighbour);
    flushRounds();
    flushRounds();
    expect(factor(label)).toBeLessThanOrEqual(0.6);
    expect(0.6 - factor(label)).toBeLessThan(1 / 128);
  });

  it('a text that overflows even at its minimum is marked once, and not fitted again', () => {
    let frames = 0;
    setFrameScheduler(() => { frames += 1; });
    const over = fakeText(-1, 50, 20);
    attachFitText(over);
    flushRounds();
    expect(over.dataset.overflow).toBe('true');
    expect(frames).toBe(1);
  });

  it('a zoom change fits it again: its bounds may be in the unit the zoom scales, and its box need not resize', () => {
    let limit = 0.6;
    const a = fakeText(() => limit);
    const h = attachFitText(a);
    flushRounds();
    expect(0.6 - factor(a)).toBeLessThan(1 / 128);
    // Larger: the same factor is now a larger size, which fits only up to 0.3.
    limit = 0.3;
    setHostZoom(1.5);
    flushRounds();
    expect(factor(a)).toBeLessThanOrEqual(0.3);
    expect(0.3 - factor(a)).toBeLessThan(1 / 128);
    // Detached, it no longer follows the zoom.
    h.detach();
    limit = 0.1;
    clearHostZoom();
    flushRounds();
    expect(factor(a)).toBeGreaterThan(0.1);
  });

  it('a member leaving refits the rest at the size they share', () => {
    const a = fakeText(0.6), b = fakeText(0.3);
    attachFitText(a, { group: 'g3' });
    const hb = attachFitText(b, { group: 'g3' });
    flushRounds();
    hb.detach();
    flushRounds();
    expect(0.6 - factor(a)).toBeLessThan(1 / 128);
  });
});
