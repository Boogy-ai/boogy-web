// usePagedList and <PagedListEnd>: a list loaded a page at a time by its
// cursor (`pagedList` in the core package). The hook loads the first page on
// its own and starts over when its deps change; the end asks for the next
// page as it comes near the view, and offers a "Load more" button too.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { pagedList, pagedListEnd, revealOnScroll, type CursorPageOf, type PagedListOptions, type PagedListState } from '@boogy/web';
import { Button } from './button';

export interface PagedListApi<T> extends PagedListState<T> {
  loadMore(): Promise<void>;
  /** Start over from the first page (after a change the list must show). */
  reload(): void;
  /** Change what is loaded, in place: a live update to one item. */
  edit(fn: (items: T[]) => T[]): void;
}

export function usePagedList<T>(
  fetchPage: (cursor: string | null) => Promise<CursorPageOf<T>>,
  deps: readonly unknown[],
  opts?: PagedListOptions,
): PagedListApi<T> {
  const [state, setState] = useState<PagedListState<T>>({ items: [], loading: false, done: false, error: null });
  const latest = useRef(fetchPage);
  latest.current = fetchPage;
  const list = useMemo(() => pagedList<T>((c) => latest.current(c), setState, opts), deps);
  useEffect(() => {
    list.reset();
    void list.loadMore();
    return () => list.reset();
  }, [list]);
  return {
    ...state,
    loadMore: () => list.loadMore(),
    reload: () => { list.reset(); void list.loadMore(); },
    edit: (fn) => list.edit(fn as (items: unknown[]) => unknown[]),
  };
}

export type PagedListEndProps = {
  loading: boolean;
  done: boolean;
  onMore: () => void;
  /** The button's words. Default "Load more". */
  label?: string;
  /** The last read failed: it then reads again only when pressed ("Try
   *  again"), never by itself, so a failing read is not asked for in a loop. */
  error?: unknown;
};

/** The end of a paged list: nothing once it is done. */
export function PagedListEnd({ loading, done, onMore, label = 'Load more', error }: PagedListEndProps) {
  const failed = error != null;
  const el = useRef<HTMLDivElement>(null);
  const more = useRef(onMore);
  more.current = onMore;
  // Re-armed after each page: a short page leaves the end in view, and
  // observing it again asks again, until the list fills the view or is done.
  useEffect(() => {
    if (loading || done || failed || !el.current) return;
    return revealOnScroll(el.current, () => more.current());
  }, [loading, done, failed]);
  if (done) return null;
  return (
    <div ref={el} {...pagedListEnd()}>
      <Button variant="quiet" size="sm" disabled={loading} onClick={() => onMore()}>{failed ? 'Try again' : label}</Button>
    </div>
  );
}
