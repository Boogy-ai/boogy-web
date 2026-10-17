import { describe, it, expect } from 'vitest';
import { vendorLoader } from './vendor-loader';

describe('vendorLoader', () => {
  it('loads once; loaded() has it after; each loader is its own', async () => {
    let calls = 0;
    const a = vendorLoader(async () => { calls++; return 'a'; });
    const b = vendorLoader(async () => 'b');
    expect(a.loaded()).toBeNull();
    const first = a.load();
    expect(a.load()).toBe(first);
    expect(await first).toBe('a');
    expect(a.loaded()).toBe('a');
    expect(calls).toBe(1);
    expect(await b.load()).toBe('b');
  });
  it('a failed load is forgotten, so the next asker tries again', async () => {
    const l = vendorLoader<string>(async () => { throw new Error('offline'); });
    await expect(l.load()).rejects.toThrow('offline');
    await expect(l.load(async () => 'ok')).resolves.toBe('ok');
  });
});
