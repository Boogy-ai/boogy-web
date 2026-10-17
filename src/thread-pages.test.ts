import { describe, it, expect } from 'vitest';
import {
  threadAdd, threadKeep, threadLoaded, threadMeasure, threadNewest, threadOlder, threadRemove, threadRestore, threadStart, type ThreadOrder,
} from './thread-pages';

type M = { id: number; at: number; body?: string };
const order: ThreadOrder<M> = { key: (m) => m.id, compare: (a, b) => a.at - b.at || a.id - b.id };
const m = (id: number, body?: string): M => ({ id, at: id * 10, body });
/** A page as a chat route returns it: newest first. */
const page = (ids: number[], next: string | null = null) => ({ items: ids.map((id) => m(id)).sort((a, b) => b.at - a.at), next_cursor: next });
const ids = (items: M[]) => items.map((x) => x.id);

describe('threadStart', () => {
  it('one page, the newest (no cursor), its items oldest first; older is where the next page starts', () => {
    const s = threadStart(order, page([10, 11, 12], 'c1'));
    expect(s.pages.map((p) => p.cursor)).toEqual([null]);
    expect(ids(s.pages[0].items!)).toEqual([10, 11, 12]);
    expect(s.older).toBe('c1');
  });
  it('a room with nothing: one empty page, nothing older', () => {
    const s = threadStart(order, { items: [] });
    expect(s.pages[0].items).toEqual([]);
    expect(s.older).toBeNull();
  });
});

describe('threadOlder', () => {
  it('puts the older page above, remembering the cursor that fetched it, and moves older on', () => {
    let s = threadStart(order, page([10, 11], 'c1'));
    s = threadOlder(order, s, page([8, 9], 'c2'));
    expect(s.pages.map((p) => p.cursor)).toEqual(['c1', null]);
    expect(ids(threadLoaded(s))).toEqual([8, 9, 10, 11]);
    expect(s.older).toBe('c2');
    s = threadOlder(order, s, page([7]));
    expect(s.pages.map((p) => p.cursor)).toEqual(['c2', 'c1', null]);
    expect(s.older).toBeNull();
  });
  it('a message already shown newer is not shown twice', () => {
    let s = threadStart(order, page([10, 11], 'c1'));
    s = threadOlder(order, s, page([9, 10], 'c2'));
    expect(ids(threadLoaded(s))).toEqual([9, 10, 11]);
  });
});

describe('threadNewest', () => {
  it('a re-read of the newest page merges in: new ones added, the server copy kept', () => {
    let s = threadStart(order, page([10, 11], 'c1'));
    s = threadNewest(order, s, { items: [m(13), m(12), { ...m(11), body: 'edited' }], next_cursor: 'cX' });
    expect(ids(threadLoaded(s))).toEqual([10, 11, 12, 13]);
    expect(threadLoaded(s).find((x) => x.id === 11)!.body).toBe('edited');
    expect(s.older).toBe('c1');
  });
  it('a re-read sharing nothing with what is shown means more was missed than a page: it starts over', () => {
    let s = threadStart(order, page([10, 11], 'c1'));
    s = threadOlder(order, s, page([8, 9], 'c2'));
    s = threadNewest(order, s, page([40, 41], 'c9'));
    expect(s.pages.map((p) => p.cursor)).toEqual([null]);
    expect(ids(threadLoaded(s))).toEqual([40, 41]);
    expect(s.older).toBe('c9');
  });
  it('within the re-read range, a message the server no longer has is gone (a delete missed while away)', () => {
    let s = threadStart(order, page([10, 11, 12, 13], 'c1'));
    s = threadAdd(order, s, m(20));
    // The server deleted 12; 20 was sent after the re-read began and stays.
    s = threadNewest(order, s, page([11, 13], 'c1'));
    expect(ids(threadLoaded(s))).toEqual([10, 11, 13, 20]);
  });
  it('every start-over is numbered; a merge is not one', () => {
    const a = threadStart(order, page([10, 11], 'c1'));
    const merged = threadNewest(order, a, page([11, 12], 'c1'));
    expect(merged.started).toBe(a.started);
    const over = threadNewest(order, merged, page([40, 41], 'c9'));
    expect(over.started).not.toBe(a.started);
  });
  it('a room that had nothing takes its first messages without starting over', () => {
    let s = threadStart(order, { items: [] });
    s = threadNewest(order, s, page([1]));
    expect(ids(threadLoaded(s))).toEqual([1]);
  });
});

describe('threadAdd and threadRemove', () => {
  it('a message added joins the newest page once; one removed leaves whichever page holds it', () => {
    let s = threadStart(order, page([10, 11], 'c1'));
    s = threadOlder(order, s, page([8, 9], 'c2'));
    s = threadAdd(order, s, m(12));
    s = threadAdd(order, s, m(12));
    expect(ids(s.pages[1].items!)).toEqual([10, 11, 12]);
    s = threadRemove(order, s, 8);
    expect(ids(threadLoaded(s))).toEqual([9, 10, 11, 12]);
  });
});

describe('threadAdd of an older message', () => {
  it('a message older than the newest page goes into the loaded page it falls in, not below them all', () => {
    let s = threadStart(order, page([20, 21], 'c1'));
    s = threadOlder(order, s, page([10, 12], 'c2'));
    s = threadAdd(order, s, m(11));
    expect(ids(s.pages[0].items!)).toEqual([10, 11, 12]);
    expect(ids(threadLoaded(s))).toEqual([10, 11, 12, 20, 21]);
  });
  it('one older than everything loaded waits for its page to be read', () => {
    let s = threadStart(order, page([20, 21], 'c1'));
    s = threadAdd(order, s, m(5));
    expect(ids(threadLoaded(s))).toEqual([20, 21]);
  });
});

describe('threadKeep and threadRestore', () => {
  const four = () => {
    let s = threadStart(order, page([40, 41], 'c1'));
    s = threadOlder(order, s, page([30, 31], 'c2'));
    s = threadOlder(order, s, page([20, 21], 'c3'));
    s = threadOlder(order, s, page([10, 11], null));
    return s; // pages: c3 [10,11], c2 [20,21], c1 [30,31], null [40,41]
  };
  it('pages outside the window give up their items but keep their height; the newest is always kept', () => {
    let s = four();
    s = threadMeasure(s, 'c3', 120);
    const kept = threadKeep(s, 1, 1);
    expect(kept.state.pages.map((p) => p.items === null)).toEqual([true, false, true, false]);
    expect(kept.state.pages[0].height).toBe(120);
    expect(kept.restore).toEqual([]);
  });
  it('a page back inside the window is named for restoring, by its own cursor', () => {
    const s = threadKeep(four(), 0, 0).state;
    expect(threadKeep(s, 1, 2).restore).toEqual(['c2', 'c1']);
  });
  it('a restored page takes its items again, none shown twice', () => {
    let s = threadKeep(four(), 0, 0).state;
    s = threadRestore(order, s, 'c2', page([21, 30, 20], 'c3'));
    // 30 is c1's, but c1 is not loaded: nothing to show it twice against yet.
    expect(ids(s.pages[1].items!)).toEqual([20, 21, 30]);
    s = threadRestore(order, s, 'c1', page([31, 30], 'c2'));
    expect(ids(threadLoaded(s))).toEqual([10, 11, 20, 21, 30, 31, 40, 41]);
  });
  it('a restore for a page no longer there changes nothing', () => {
    const s = threadKeep(four(), 0, 0).state;
    expect(threadRestore(order, s, 'gone', page([1]))).toBe(s);
  });
});
