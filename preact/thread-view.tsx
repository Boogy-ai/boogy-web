// useThread and <ThreadView>: a conversation of any length, read newest first
// a page at a time (see `threadPages` in the core package).
//
// ThreadView owns the scrolling. It opens at the newest message; as the reader
// nears the top it reads the page before (a button too, for keyboards), and
// what they were reading stays where it was. It follows new messages only
// while the reader is at the end, or when one is added to be revealed (their
// own, just sent). However far back they read, only a window of pages holds
// its messages: the rest are spacers of their measured height, and a page is
// read again by its own cursor as the reader comes back to it. The reader's
// place is kept by the message at the top of the view, not by the browser's
// own scroll anchoring, so a page arriving or going above never moves them.
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  thread as threadAttrs, threadAdd, threadKeep, threadLoaded, threadMeasure, threadNewest, threadOlder, threadRemove, threadRestore,
  threadStart, threadView, type CursorPageOf, type ThreadOrder, type ThreadPage, type ThreadState,
} from '@boogy/web';
import { PagedListEnd } from './paged-list';

export interface ThreadApi<T> {
  /** Oldest first; a page outside the window holds no items. */
  pages: ThreadPage<T>[];
  /** Every item loaded, oldest first. */
  items: T[];
  key: (item: T) => string | number;
  /** The newest page has been read. */
  ready: boolean;
  /** There are older pages to read. */
  hasOlder: boolean;
  /** An older page is on its way. */
  loading: boolean;
  /** The last read failed; reading again tries again. */
  error: unknown;
  /** A page is on its way (older, or one let go coming back): the log is busy. */
  busy: boolean;
  /** Which start this is; a new number when the thread starts over. */
  started: number;
  /** The newest page has grown past its cap (a long session's live
   *  messages): `trim` when the reader is at the end. */
  newestTooLong: boolean;
  /** Counts the items added to be revealed; the view follows each. */
  revealed: number;
  loadOlder(): Promise<void>;
  /** Read the newest page again (after a signal, a reconnect) and merge it in. */
  refreshNewest(): Promise<void>;
  /** Start over from the newest page (after a first read failed, say). */
  reload(): void;
  /** Start over from a fresh read of the newest page, its long tail let go. */
  trim(): Promise<void>;
  /** An item added (live, or the reader's own; `reveal` scrolls to it). */
  add(item: T, opts?: { reveal?: boolean }): void;
  remove(key: string | number): void;
  /** The view's: keep the pages from `from` to `to`, read back any let go. */
  keep(from: number, to: number): void;
  /** The view's: a page's height as shown. */
  measure(cursor: string | null, height: number): void;
}

export interface ThreadOptions {
  /** The newest page's most items before it asks to be trimmed (live
   *  messages join it and it is never let go). Default 200. */
  newestCap?: number;
}

/** A page that failed to come back is asked for again after this, doubling,
 *  up to the most. */
const RESTORE_RETRY_MS = 2000;
const RESTORE_RETRY_MAX_MS = 30_000;

/** A thread read by `load` (one page from a cursor, null for the newest),
 *  ordered by `order`. New `deps` start over from the newest page. */
export function useThread<T>(
  load: (cursor: string | null) => Promise<CursorPageOf<T>>,
  order: ThreadOrder<T>,
  deps: readonly unknown[],
  { newestCap = 200 }: ThreadOptions = {},
): ThreadApi<T> {
  const [state, setState] = useState<ThreadState<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [restoringCount, setRestoringCount] = useState(0);
  const restoreFails = useRef(new Map<string, { until: number; n: number }>());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [revealed, setRevealed] = useState(0);
  // The state as of now, for reads that finish later.
  const now = useRef<ThreadState<T> | null>(null);
  const set = (next: ThreadState<T> | null) => {
    if (next === now.current) return;
    now.current = next;
    setState(next);
  };
  const latest = useRef({ load, order });
  latest.current = { load, order };
  // A read started before the deps changed is dropped when it lands.
  const generation = useRef(0);
  const olderInFlight = useRef(false);
  const restoring = useRef(new Set<string>());

  useEffect(() => {
    const mine = ++generation.current;
    now.current = null;
    setState(null);
    setError(null);
    setLoading(false);
    olderInFlight.current = false;
    restoring.current.clear();
    restoreFails.current.clear();
    setRestoringCount(0);
    latest.current.load(null).then(
      (page) => { if (generation.current === mine) set(threadStart(latest.current.order, page)); },
      (e: unknown) => { if (generation.current === mine) setError(e); },
    );
  }, [...deps, attempt]);

  const loadOlder = async () => {
    const from = now.current;
    if (!from || from.older === null || olderInFlight.current) return;
    const mine = generation.current;
    olderInFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const page = await latest.current.load(from.older);
      // Still the same boundary: a start-over meanwhile makes this page stale.
      if (generation.current === mine && now.current?.older === from.older) set(threadOlder(latest.current.order, now.current, page));
    } catch (e) {
      if (generation.current === mine) setError(e);
    } finally {
      if (generation.current === mine) {
        olderInFlight.current = false;
        setLoading(false);
      }
    }
  };

  const refreshNewest = async () => {
    const mine = generation.current;
    try {
      const page = await latest.current.load(null);
      if (generation.current === mine && now.current) {
        set(threadNewest(latest.current.order, now.current, page));
        setError(null);
      }
    } catch (e) {
      if (generation.current === mine) setError(e);
    }
  };

  const trim = async () => {
    const mine = generation.current;
    try {
      const page = await latest.current.load(null);
      if (generation.current === mine) set(threadStart(latest.current.order, page));
    } catch (e) {
      if (generation.current === mine) setError(e);
    }
  };

  const keep = (from: number, to: number) => {
    if (!now.current) return;
    const { state: next, restore } = threadKeep(now.current, from, to);
    set(next);
    const mine = generation.current;
    for (const cursor of restore) {
      if (restoring.current.has(cursor)) continue;
      // One that failed waits its turn, the wait doubling: never a read a frame.
      const failed = restoreFails.current.get(cursor);
      if (failed && failed.until > Date.now()) continue;
      restoring.current.add(cursor);
      setRestoringCount(restoring.current.size);
      latest.current.load(cursor).then(
        (page) => {
          restoring.current.delete(cursor);
          restoreFails.current.delete(cursor);
          if (generation.current !== mine) return;
          setRestoringCount(restoring.current.size);
          if (now.current) set(threadRestore(latest.current.order, now.current, cursor, page));
        },
        (e: unknown) => {
          restoring.current.delete(cursor);
          if (generation.current !== mine) return;
          setRestoringCount(restoring.current.size);
          const n = (restoreFails.current.get(cursor)?.n ?? 0) + 1;
          restoreFails.current.set(cursor, { n, until: Date.now() + Math.min(RESTORE_RETRY_MS * 2 ** (n - 1), RESTORE_RETRY_MAX_MS) });
          setError(e);
        },
      );
    }
  };

  const items = useMemo(() => (state ? threadLoaded(state) : []), [state]);
  const newestItems = state?.pages[state.pages.length - 1]?.items;
  return {
    pages: state?.pages ?? [],
    items,
    key: order.key,
    ready: state !== null,
    hasOlder: state !== null && state.older !== null,
    loading,
    error,
    busy: loading || restoringCount > 0,
    started: state?.started ?? 0,
    newestTooLong: !!newestItems && newestItems.length > newestCap,
    revealed,
    loadOlder,
    refreshNewest,
    reload: () => setAttempt((a) => a + 1),
    trim,
    add(item, opts) {
      if (now.current) set(threadAdd(latest.current.order, now.current, item));
      if (opts?.reveal) setRevealed((r) => r + 1);
    },
    remove(key) {
      if (now.current) set(threadRemove(latest.current.order, now.current, key));
    },
    keep,
    measure(cursor, height) {
      if (now.current) set(threadMeasure(now.current, cursor, height));
    },
  };
}

export type ThreadViewProps<T> = {
  thread: ThreadApi<T>;
  /** The conversation's name (it is a log). */
  label: string;
  /** One item; `before` is the item shown above it (for runs by one author),
   *  undefined at the top of what is loaded. */
  renderItem: (item: T, before: T | undefined) => ComponentChildren;
  /** Pages kept either side of the reader's. Default 2. */
  windowPages?: number;
  /** The button that reads the page before. Default "Earlier messages". */
  olderLabel?: string;
  /** Shown when the thread has nothing at all. */
  empty?: ComponentChildren;
  /** After the last message, in the log (someone typing, say). */
  after?: ComponentChildren;
  /** A shadow under each bubble (see `Thread`). */
  shadow?: boolean;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'label'>;

/** The first of `els` (in order down the page) whose bottom is below `y`. */
function firstBelow(els: ArrayLike<Element>, y: number): number {
  let lo = 0;
  let hi = els.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (els[mid].getBoundingClientRect().bottom > y) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function ThreadView<T>({ thread, label, renderItem, windowPages = 2, olderLabel = 'Earlier messages', empty, after, shadow, ...rest }: ThreadViewProps<T>) {
  const scroller = useRef<HTMLDivElement>(null);
  // Where the reader is: near the end (within a quarter of the view: new
  // messages are followed), right at it (what grows there is followed), or
  // the item at the top of the view and the one after it, and how far below
  // the view's top each sits (the second holds the place if the first goes).
  type Place = { atEnd: boolean; flush: boolean; key: string | null; offset: number; next: string | null; nextOffset: number };
  const AT_END: Place = { atEnd: true, flush: true, key: null, offset: 0, next: null, nextOffset: 0 };
  const place = useRef<Place>({ ...AT_END });
  const seenReveal = useRef(thread.revealed);
  const seenStart = useRef(thread.started);
  const api = useRef(thread);
  api.current = thread;

  // Where the reader was last right at the end (the view put them there, or
  // they scrolled there). Until they scroll away from it, they are still at
  // the end, however much grows under them first: a message's cards and
  // images arrive after it, and growth is not the reader moving.
  const pinned = useRef<number | null>(null);

  /** The reader to the end, and held there. */
  const toEnd = (el: HTMLElement) => {
    el.scrollTop = el.scrollHeight;
    pinned.current = el.scrollTop;
    place.current.atEnd = true;
    place.current.flush = true;
  };

  /** Whether the reader is near the end, or right at it. */
  const noteEnd = () => {
    const el = scroller.current;
    if (!el) return;
    if (pinned.current !== null && Math.abs(el.scrollTop - pinned.current) <= 1) {
      place.current.atEnd = true;
      place.current.flush = true;
      return;
    }
    const below = el.scrollHeight - el.scrollTop - el.clientHeight;
    place.current.atEnd = below <= el.clientHeight / 4;
    place.current.flush = below <= 1;
    pinned.current = place.current.flush ? el.scrollTop : null;
  };

  /** Note the reader's place, and keep the window around it. */
  const note = () => {
    const el = scroller.current;
    if (!el) return;
    noteEnd();
    const top = el.getBoundingClientRect().top;
    const items = el.querySelectorAll<HTMLElement>('[data-slot="item"]');
    const at = firstBelow(items, top);
    const anchor = items[at];
    const next = items[at + 1];
    place.current.key = anchor ? anchor.dataset.key ?? null : null;
    place.current.offset = anchor ? anchor.getBoundingClientRect().top - top : 0;
    place.current.next = next ? next.dataset.key ?? null : null;
    place.current.nextOffset = next ? next.getBoundingClientRect().top - top : 0;
    // The window centres on the page at the middle of the view, and always
    // holds the page with focus in it (a button pressed in it).
    const pages = el.querySelectorAll<HTMLElement>('[data-slot="page"]');
    const middle = Math.min(firstBelow(pages, top + el.clientHeight / 2), pages.length - 1);
    if (middle < 0) return;
    let from = middle - windowPages;
    let to = middle + windowPages;
    const focused = document.activeElement?.closest<HTMLElement>('[data-slot="page"]');
    if (focused && el.contains(focused)) {
      const i = Number(focused.dataset.index);
      from = Math.min(from, i);
      to = Math.max(to, i);
    }
    api.current.keep(from, to);
    // At the end with a newest page grown long: start over from a fresh read.
    if (place.current.atEnd && api.current.newestTooLong) void api.current.trim();
  };

  const frame = useRef(0);
  const onScroll = () => {
    // Where the end is, now: what grows at it in this same frame reads it.
    noteEnd();
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      note();
    });
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // After every change: back to the end if the reader was there (or their own
  // message was added), else the item they were reading where it was.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !thread.ready) return;
    // A start-over: whatever the reader held is gone; they go to the newest.
    if (thread.started !== seenStart.current) {
      seenStart.current = thread.started;
      place.current = { ...AT_END };
    }
    const p = place.current;
    if (thread.revealed !== seenReveal.current || p.atEnd) {
      seenReveal.current = thread.revealed;
      toEnd(el);
    } else {
      const find = (key: string | null) => (key === null ? null : el.querySelector<HTMLElement>(`[data-slot="item"][data-key="${CSS.escape(key)}"]`));
      const anchor = find(p.key);
      const next = anchor ? null : find(p.next);
      const held = anchor ?? next;
      if (held) el.scrollTop += held.getBoundingClientRect().top - el.getBoundingClientRect().top - (anchor ? p.offset : p.nextOffset);
    }
    note();
  }, [thread.pages, thread.revealed, thread.ready]);

  // What grows at the end without a page changing (someone typing, an image
  // arriving, a block opened), and the view itself growing shorter (a
  // composer taking more lines), keep a reader who was at the end there.
  const log = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    const content = log.current;
    if (!el || !content || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { if (place.current.flush) toEnd(el); });
    ro.observe(content);
    ro.observe(el);
    return () => ro.disconnect();
  }, [thread.ready]);

  // Each page shown is measured, so a page let go leaves a spacer its height.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const page = e.target as HTMLElement;
        const cursor = page.dataset.cursor ?? null;
        api.current.measure(cursor === '' ? null : cursor, page.getBoundingClientRect().height);
      }
    });
    el.querySelectorAll('[data-slot="page"]:not([data-spacer])').forEach((page) => ro.observe(page));
    return () => ro.disconnect();
  }, [thread.pages]);

  let before: T | undefined;
  const body = thread.pages.map((p, i) => {
    if (p.items === null) {
      before = undefined;
      return <div key={p.cursor ?? ''} data-slot="page" data-spacer="" data-index={i} style={{ blockSize: `${p.height ?? 0}px` }} />;
    }
    return (
      <div key={p.cursor ?? ''} data-slot="page" data-index={i} data-cursor={p.cursor ?? ''}>
        {p.items.map((item) => {
          const shown = renderItem(item, before);
          before = item;
          const key = String(thread.key(item));
          return <div key={key} data-slot="item" data-key={key}>{shown}</div>;
        })}
      </div>
    );
  });

  return (
    <div {...rest} {...threadView()} ref={scroller} onScroll={onScroll}>
      {thread.hasOlder && <PagedListEnd loading={thread.loading} done={!thread.hasOlder} error={thread.error} onMore={() => void thread.loadOlder()} label={olderLabel} />}
      {thread.ready && thread.items.length === 0 && !thread.hasOlder ? empty : (
        // Busy while pages arrive above: a log announces additions, and these are none.
        <div {...threadAttrs({ shadow })} ref={log} role="log" aria-label={label} aria-busy={thread.busy ? 'true' : undefined}>{body}{after}</div>
      )}
    </div>
  );
}
