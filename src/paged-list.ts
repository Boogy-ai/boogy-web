// pagedList: a list loaded one page at a time by its cursor, for any list a
// person scrolls. Every list pages from the first screen: a page is never the
// whole set, and nothing here ever asks for one.
//
// Framework-free: it holds the items, the cursor and whether more remain, and
// reports each change. `usePagedList` (Preact) wraps it for a component.

/** One page as a Boogy route returns it: the items, and the cursor to the next
 *  page, absent or null at the end. */
export interface CursorPageOf<T> {
  items: T[];
  next_cursor?: string | null;
}

export interface PagedListState<T> {
  items: T[];
  /** A page is on its way. */
  loading: boolean;
  /** No cursor came back: there is nothing more. */
  done: boolean;
  /** The last page asked for failed; `loadMore` tries it again. */
  error: unknown;
}

export interface PagedListOptions {
  /** A page can come back empty with a cursor (a service passing over what
   *  the reader may not see): it loads on by itself, at most this many empty
   *  pages in a row per `loadMore`. Default 5. */
  maxEmptyPages?: number;
}

export interface PagedList {
  /** Load the next page (no-op while one is loading, or when done). */
  loadMore(): Promise<void>;
  /** Start over, empty. A page still on its way is discarded. */
  reset(): void;
  /** Change what is loaded, in place (a live update: one item replaced, one
   *  gone, one added at the end). The cursor stays where it was. */
  edit(fn: (items: unknown[]) => unknown[]): void;
}

export function pagedList<T>(
  fetchPage: (cursor: string | null) => Promise<CursorPageOf<T>>,
  onChange: (state: PagedListState<T>) => void,
  { maxEmptyPages = 5 }: PagedListOptions = {},
): PagedList {
  let items: T[] = [];
  let cursor: string | null = null;
  let done = false;
  let loading = false;
  let error: unknown = null;
  let generation = 0;
  const emit = () => onChange({ items, loading, done, error });

  async function loadMore(): Promise<void> {
    if (loading || done) return;
    const mine = generation;
    loading = true;
    error = null;
    emit();
    try {
      for (let empty = 0; ; ) {
        const page = await fetchPage(cursor);
        if (mine !== generation) return;
        cursor = page.next_cursor ?? null;
        done = cursor === null;
        if (page.items.length > 0) {
          items = [...items, ...page.items];
          break;
        }
        if (done || ++empty >= maxEmptyPages) break;
      }
    } catch (e) {
      if (mine !== generation) return;
      error = e;
    }
    loading = false;
    emit();
  }

  function reset(): void {
    generation++;
    items = [];
    cursor = null;
    done = false;
    loading = false;
    error = null;
    emit();
  }

  function edit(fn: (items: T[]) => T[]): void {
    items = fn(items);
    emit();
  }

  return { loadMore, reset, edit: edit as PagedList['edit'] };
}
