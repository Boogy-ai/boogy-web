import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { useThread, type ThreadApi } from './index';
import type { CursorPageOf, ThreadOrder } from '@boogy/web';

type M = { id: number; at: number };
const order: ThreadOrder<M> = { key: (m) => m.id, compare: (a, b) => a.at - b.at || a.id - b.id };
/** A room of `n` messages, read newest first, `per` a page; the cursor is the
 *  id the next page starts below. */
function room(n: number, per = 3) {
  const all = Array.from({ length: n }, (_, i) => ({ id: i + 1, at: (i + 1) * 10 }));
  const load = vi.fn(async (cursor: string | null): Promise<CursorPageOf<M>> => {
    const below = cursor === null ? Infinity : Number(cursor);
    const items = all.filter((m) => m.id < below).reverse().slice(0, per);
    const last = items[items.length - 1];
    return { items, next_cursor: last && last.id > 1 ? String(last.id) : null };
  });
  return { all, load };
}

afterEach(() => { document.body.replaceChildren(); });
function harness<T>(make: () => ThreadApi<T>) {
  const api: { current: ThreadApi<T> | null } = { current: null };
  function Probe() { api.current = make(); return null; }
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(<Probe />, root));
  return api as { current: ThreadApi<T> };
}
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const ids = (t: ThreadApi<M>) => t.items.map((m) => m.id);

describe('useThread', () => {
  it('reads the newest page on its own, and says what is older', async () => {
    const { load } = room(10);
    const t = harness(() => useThread(load, order, []));
    await settle();
    expect(load).toHaveBeenCalledWith(null);
    expect(t.current.ready).toBe(true);
    expect(ids(t.current)).toEqual([8, 9, 10]);
    expect(t.current.hasOlder).toBe(true);
  });

  it('loadOlder reads the page before the oldest, by its cursor, and stops at the start', async () => {
    const { load } = room(5);
    const t = harness(() => useThread(load, order, []));
    await settle();
    await act(async () => { await t.current.loadOlder(); });
    expect(load).toHaveBeenLastCalledWith('3');
    expect(ids(t.current)).toEqual([1, 2, 3, 4, 5]);
    expect(t.current.hasOlder).toBe(false);
  });

  it('a page let go and brought back into the window is read again by its own cursor', async () => {
    const { load } = room(12);
    const t = harness(() => useThread(load, order, []));
    await settle();
    for (let i = 0; i < 3; i++) await act(async () => { await t.current.loadOlder(); });
    expect(t.current.pages.map((p) => p.cursor)).toEqual(['4', '7', '10', null]);
    act(() => t.current.keep(0, 0));
    expect(t.current.pages.map((p) => p.items === null)).toEqual([false, true, true, false]);
    load.mockClear();
    act(() => t.current.keep(1, 2));
    await settle();
    expect(load.mock.calls.map((c) => c[0]).sort()).toEqual(['10', '7']);
    // Pages 1 and 2 are back; page 0 is now outside the window, let go.
    expect(t.current.pages.map((p) => p.items === null)).toEqual([true, false, false, false]);
    expect(ids(t.current)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('add joins the newest page, remove takes one out; refreshNewest merges a re-read', async () => {
    const { load, all } = room(6);
    const t = harness(() => useThread(load, order, []));
    await settle();
    act(() => t.current.add({ id: 7, at: 70 }, { reveal: true }));
    expect(ids(t.current)).toEqual([4, 5, 6, 7]);
    expect(t.current.revealed).toBe(1);
    act(() => t.current.remove(5));
    expect(ids(t.current)).toEqual([4, 6, 7]);
    all.push({ id: 7, at: 70 }, { id: 8, at: 80 });
    await act(async () => { await t.current.refreshNewest(); });
    expect(ids(t.current)).toEqual([4, 6, 7, 8]);
  });

  it('new deps start over from the newest page', async () => {
    const a = room(4);
    const b = room(9);
    let which = a;
    let dep = 'a';
    const root = document.createElement('div');
    document.body.appendChild(root);
    const api: { current: ThreadApi<M> | null } = { current: null };
    function Probe({ d }: { d: string }) { api.current = useThread((c) => which.load(c), order, [d]); return null; }
    act(() => render(<Probe d={dep} />, root));
    await settle();
    expect(api.current!.items.map((m) => m.id)).toEqual([2, 3, 4]);
    which = b; dep = 'b';
    act(() => render(<Probe d={dep} />, root));
    await settle();
    expect(api.current!.items.map((m) => m.id)).toEqual([7, 8, 9]);
  });

  it('a page that fails to come back is not asked for again at once; later it is, and the failure is told', async () => {
    vi.useFakeTimers();
    try {
      const { load } = room(12);
      const t = harness(() => useThread(load, order, []));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      for (let i = 0; i < 3; i++) await act(async () => { await t.current.loadOlder(); });
      act(() => t.current.keep(0, 0));
      load.mockClear();
      load.mockImplementationOnce(async () => { throw new Error('offline'); });
      act(() => t.current.keep(0, 1));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(load).toHaveBeenCalledTimes(1);
      expect(t.current.error).toBeInstanceOf(Error);
      for (let i = 0; i < 5; i++) act(() => t.current.keep(0, 1));
      expect(load).toHaveBeenCalledTimes(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      act(() => t.current.keep(0, 1));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(load).toHaveBeenCalledTimes(2);
      expect(t.current.pages[1].items).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a first read that failed is read again by reload', async () => {
    const { load } = room(6);
    load.mockImplementationOnce(async () => { throw new Error('offline'); });
    const t = harness(() => useThread(load, order, []));
    await settle();
    expect(t.current.ready).toBe(false);
    expect(t.current.error).toBeInstanceOf(Error);
    act(() => t.current.reload());
    await settle();
    expect(t.current.ready).toBe(true);
    expect(t.current.error).toBeNull();
  });

  it('a newest page grown past its cap says so; trim starts over from a fresh read of it', async () => {
    const { load, all } = room(3);
    const t = harness(() => useThread(load, order, [], { newestCap: 5 }));
    await settle();
    for (let id = 4; id <= 8; id++) { all.push({ id, at: id * 10 }); act(() => t.current.add({ id, at: id * 10 })); }
    expect(t.current.newestTooLong).toBe(true);
    const started = t.current.started;
    await act(async () => { await t.current.trim(); });
    expect(t.current.started).not.toBe(started);
    expect(ids(t.current)).toEqual([6, 7, 8]);
    expect(t.current.newestTooLong).toBe(false);
  });

  it('busy while an older page is on its way', async () => {
    const { load } = room(9);
    const t = harness(() => useThread(load, order, []));
    await settle();
    let resolve: (v: CursorPageOf<M>) => void = () => {};
    load.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    let done: Promise<void> = Promise.resolve();
    act(() => { done = t.current.loadOlder(); });
    expect(t.current.busy).toBe(true);
    await act(async () => { resolve({ items: [], next_cursor: null }); await done; });
    expect(t.current.busy).toBe(false);
  });
});
