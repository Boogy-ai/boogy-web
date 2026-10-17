import { describe, it, expect } from 'vitest';
import { pagedList, type PagedListState, type CursorPageOf } from './paged-list';

/** A source of `total` numbered items, `size` a page, with a cursor. */
function source(total: number, size: number, opts: { emptyUntil?: number } = {}) {
  const calls: (string | null)[] = [];
  const fetchPage = async (cursor: string | null): Promise<CursorPageOf<number>> => {
    calls.push(cursor);
    const from = cursor ? Number(cursor) : 0;
    // Pages passed over (a server filtering what the caller may see): empty, with a cursor.
    if (opts.emptyUntil && from < opts.emptyUntil) return { items: [], next_cursor: String(from + size) };
    const items = Array.from({ length: Math.max(0, Math.min(size, total - from)) }, (_, i) => from + i);
    const next = from + size < total ? String(from + size) : null;
    return { items, next_cursor: next };
  };
  return { fetchPage, calls };
}

function harness(fetchPage: (c: string | null) => Promise<CursorPageOf<number>>, opts = {}) {
  let last: PagedListState<number> = { items: [], loading: false, done: false, error: null };
  const list = pagedList(fetchPage, (s) => { last = s; }, opts);
  return { list, state: () => last };
}

describe('pagedList', () => {
  it('loads a page at a time by its cursor, and is done when no cursor comes back', async () => {
    const s = source(5, 2);
    const h = harness(s.fetchPage);
    await h.list.loadMore();
    expect(h.state().items).toEqual([0, 1]);
    expect(h.state().done).toBe(false);
    await h.list.loadMore();
    await h.list.loadMore();
    expect(h.state().items).toEqual([0, 1, 2, 3, 4]);
    expect(h.state().done).toBe(true);
    expect(s.calls).toEqual([null, '2', '4']);
  });

  it('never loads past the last page, and never loads twice at once', async () => {
    const s = source(2, 2);
    const h = harness(s.fetchPage);
    await Promise.all([h.list.loadMore(), h.list.loadMore()]);
    await h.list.loadMore();
    expect(s.calls).toEqual([null]);
    expect(h.state().items).toEqual([0, 1]);
  });

  it('a page that comes back empty with a cursor is not the end: it loads on, within a bound', async () => {
    const s = source(4, 2, { emptyUntil: 4 });
    const h = harness(s.fetchPage, { maxEmptyPages: 5 });
    await h.list.loadMore();
    expect(s.calls).toEqual([null, '2', '4']);
    expect(h.state().done).toBe(true);
    const t = source(100, 2, { emptyUntil: 100 });
    const g = harness(t.fetchPage, { maxEmptyPages: 3 });
    await g.list.loadMore();
    expect(t.calls).toHaveLength(3);
    expect(g.state().done).toBe(false);
  });

  it('a reset starts over and discards a page still on its way', async () => {
    let release: () => void = () => {};
    const slow = (cursor: string | null) => new Promise<CursorPageOf<number>>((r) => { release = () => r({ items: [cursor ? 9 : 1], next_cursor: null }); });
    const h = harness(slow);
    const pending = h.list.loadMore();
    h.list.reset();
    release();
    await pending;
    expect(h.state().items).toEqual([]);
    expect(h.state().done).toBe(false);
    expect(h.state().loading).toBe(false);
  });

  it('edit changes what is loaded in place (a live update), and the cursor stays where it was', async () => {
    const s = source(4, 2);
    const h = harness(s.fetchPage);
    await h.list.loadMore();
    h.list.edit((items) => (items as number[]).map((x) => x * 10).filter((x) => x !== 0));
    expect(h.state().items).toEqual([10]);
    await h.list.loadMore();
    expect(h.state().items).toEqual([10, 2, 3]);
    expect(s.calls).toEqual([null, '2']);
  });

  it('a failed page is reported and can be tried again; nothing loaded is lost', async () => {
    let fail = true;
    const s = source(4, 2);
    const flaky = async (c: string | null) => { if (c && fail) throw new Error('offline'); return s.fetchPage(c); };
    const h = harness(flaky);
    await h.list.loadMore();
    await h.list.loadMore();
    expect(h.state().error).toBeInstanceOf(Error);
    expect(h.state().items).toEqual([0, 1]);
    fail = false;
    await h.list.loadMore();
    expect(h.state().error).toBeNull();
    expect(h.state().items).toEqual([0, 1, 2, 3]);
  });
});
