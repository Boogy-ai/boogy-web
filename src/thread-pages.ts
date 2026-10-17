// threadPages: a conversation (or any feed read newest first) held as the
// pages it was read in, so a room of any length shows a page at a time and
// keeps only a window of them. Framework-free and pure: each function returns
// the next state. `useThread` and `ThreadView` (Preact) drive it.
//
// The pages are oldest first. Each remembers the cursor that fetched it, its
// id: the newest page has none (null), and live messages join it. Reading back
// puts older pages above. A page outside the reader's window gives up its
// items but keeps its measured height (a spacer holds its place); back in the
// window it is fetched again by its own cursor, and nothing in it is shown
// twice. The newest page is never given up.
import type { CursorPageOf } from './paged-list';

/** How a thread's items are told apart and ordered (oldest first). */
export interface ThreadOrder<T> {
  key(item: T): string | number;
  compare(a: T, b: T): number;
}

export interface ThreadPage<T> {
  /** The cursor that fetched it; null for the newest page. Its id. */
  cursor: string | null;
  /** Its items, oldest first; null while it is outside the window. */
  items: T[] | null;
  /** Its height when last shown, in px; null before it was. */
  height: number | null;
}

export interface ThreadState<T> {
  /** Oldest first; the last is the newest page. */
  pages: ThreadPage<T>[];
  /** Where the page before the oldest starts; null when there is none. */
  older: string | null;
  /** Which start this is: a new number each time the thread starts over, so
   *  a view can tell its reader's place no longer stands. */
  started: number;
}

let starts = 0;

const sorted = <T>(o: ThreadOrder<T>, items: readonly T[]) => [...items].sort((a, b) => o.compare(a, b));

/** The keys of every loaded item outside the page `except`. */
function keysBut<T>(o: ThreadOrder<T>, s: ThreadState<T>, except: ThreadPage<T> | null): Set<string | number> {
  const keys = new Set<string | number>();
  for (const p of s.pages) if (p !== except && p.items) for (const item of p.items) keys.add(o.key(item));
  return keys;
}

/** The newest page, read first. */
export function threadStart<T>(o: ThreadOrder<T>, page: CursorPageOf<T>): ThreadState<T> {
  return { pages: [{ cursor: null, items: sorted(o, page.items), height: null }], older: page.next_cursor ?? null, started: ++starts };
}

/** The page before the oldest, read: above it, by the cursor that fetched it. */
export function threadOlder<T>(o: ThreadOrder<T>, s: ThreadState<T>, page: CursorPageOf<T>): ThreadState<T> {
  if (s.older === null) return s;
  const shown = keysBut(o, s, null);
  const items = sorted(o, page.items.filter((item) => !shown.has(o.key(item))));
  return { ...s, pages: [{ cursor: s.older, items, height: null }, ...s.pages], older: page.next_cursor ?? null };
}

/** The newest page, read again (after a signal, a reconnect): merged into the
 *  newest page, the server's copy of each item kept, and an item within the
 *  re-read's range that it no longer holds gone (a delete missed while away);
 *  one newer than the re-read (sent since it began) stays. Sharing nothing
 *  with what the newest page shows, more was missed than a page holds: start
 *  over. */
export function threadNewest<T>(o: ThreadOrder<T>, s: ThreadState<T>, page: CursorPageOf<T>): ThreadState<T> {
  const newest = s.pages[s.pages.length - 1];
  if (!newest) return threadStart(o, page);
  const had = newest.items ?? [];
  const fresh = new Set(page.items.map((item) => o.key(item)));
  if (had.length > 0 && page.items.length > 0 && !had.some((item) => fresh.has(o.key(item)))) return threadStart(o, page);
  const elsewhere = keysBut(o, s, newest);
  const range = sorted(o, page.items);
  const within = (item: T) => range.length > 0 && o.compare(item, range[0]) >= 0 && o.compare(item, range[range.length - 1]) <= 0;
  const kept = had.filter((item) => !fresh.has(o.key(item)) && !within(item));
  const merged = sorted(o, [...kept, ...page.items.filter((item) => !elsewhere.has(o.key(item)))]);
  return { ...s, pages: [...s.pages.slice(0, -1), { ...newest, items: merged }] };
}

/** One item added (the reader's own, just sent; a live one): it joins the
 *  newest page, or replaces its copy there. One older than the newest page
 *  (a late arrival) goes into the loaded page it falls in; falling in a page
 *  not loaded, or before everything loaded, it waits for that page's read. */
export function threadAdd<T>(o: ThreadOrder<T>, s: ThreadState<T>, item: T): ThreadState<T> {
  const last = s.pages.length - 1;
  if (last < 0) return threadStart(o, { items: [item] });
  const key = o.key(item);
  let at = last;
  const first = s.pages[last].items?.[0];
  if (first !== undefined && o.compare(item, first) < 0) {
    at = -1;
    for (let i = last - 1; i >= 0; i--) {
      const items = s.pages[i].items;
      if (items === null) return s;
      if (items.length > 0 && o.compare(items[0], item) <= 0) { at = i; break; }
    }
    if (at < 0) return s;
  }
  const page = s.pages[at];
  if (keysBut(o, s, page).has(key)) return s;
  const items = sorted(o, [...(page.items ?? []).filter((x) => o.key(x) !== key), item]);
  return { ...s, pages: s.pages.map((p, i) => (i === at ? { ...p, items } : p)) };
}

/** One item gone, from whichever page holds it. */
export function threadRemove<T>(o: ThreadOrder<T>, s: ThreadState<T>, key: string | number): ThreadState<T> {
  return { ...s, pages: s.pages.map((p) => (p.items && p.items.some((x) => o.key(x) === key) ? { ...p, items: p.items.filter((x) => o.key(x) !== key) } : p)) };
}

/** Keep the pages from index `from` to `to` (and the newest): the rest give up
 *  their items, keeping their height. Returns the pages inside the window that
 *  hold no items, by cursor, for fetching again. */
export function threadKeep<T>(s: ThreadState<T>, from: number, to: number): { state: ThreadState<T>; restore: string[] } {
  const last = s.pages.length - 1;
  const restore: string[] = [];
  let changed = false;
  const pages = s.pages.map((p, i) => {
    const inside = (i >= from && i <= to) || i === last;
    if (inside && p.items === null && p.cursor !== null) restore.push(p.cursor);
    if (!inside && p.items !== null) {
      changed = true;
      return { ...p, items: null };
    }
    return p;
  });
  return { state: changed ? { ...s, pages } : s, restore };
}

/** A page given up, read again by its cursor: its items back, none shown twice. */
export function threadRestore<T>(o: ThreadOrder<T>, s: ThreadState<T>, cursor: string, page: CursorPageOf<T>): ThreadState<T> {
  const at = s.pages.findIndex((p) => p.cursor === cursor);
  if (at < 0) return s;
  const shown = keysBut(o, s, s.pages[at]);
  const items = sorted(o, page.items.filter((item) => !shown.has(o.key(item))));
  return { ...s, pages: s.pages.map((p, i) => (i === at ? { ...p, items } : p)) };
}

/** A page's height as last shown. */
export function threadMeasure<T>(s: ThreadState<T>, cursor: string | null, height: number): ThreadState<T> {
  const at = s.pages.findIndex((p) => p.cursor === cursor);
  if (at < 0 || s.pages[at].height === height) return s;
  return { ...s, pages: s.pages.map((p, i) => (i === at ? { ...p, height } : p)) };
}

/** Every item loaded, oldest first. */
export function threadLoaded<T>(s: ThreadState<T>): T[] {
  return s.pages.flatMap((p) => p.items ?? []);
}
