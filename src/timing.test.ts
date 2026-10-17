import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { coalesce, throttle } from './timing';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('coalesce', () => {
  it('a burst of calls becomes one call, after a random wait of up to the jitter', () => {
    const fn = vi.fn();
    const c = coalesce(fn, { jitterMs: 300, random: () => 0.5 });
    c(); c(); c();
    vi.advanceTimersByTime(149);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    c();
    vi.advanceTimersByTime(150);
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('cancel drops a wait in progress', () => {
    const fn = vi.fn();
    const c = coalesce(fn, { jitterMs: 100, random: () => 1 });
    c();
    c.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('throttle', () => {
  it('the first call runs at once, calls within the interval are dropped, and none runs after they stop', () => {
    let t = 0;
    const fn = vi.fn();
    const th = throttle(fn, 4000, () => t);
    th('a');
    t = 1000; th('b');
    t = 3999; th('c');
    expect(fn.mock.calls).toEqual([['a']]);
    t = 4000; th('d');
    expect(fn.mock.calls).toEqual([['a'], ['d']]);
    t = 20000;
    vi.advanceTimersByTime(20000);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
