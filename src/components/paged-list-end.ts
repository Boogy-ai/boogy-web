// PagedListEnd: the end of a list loaded a page at a time (`pagedList`). It
// asks for the next page as it comes near the view, and offers a "Load more"
// button too, which keyboards and screen readers can reach.

export interface PagedListEndAttrs {
  'data-boogy': 'paged-list-end';
}

export function pagedListEnd(): PagedListEndAttrs {
  return { 'data-boogy': 'paged-list-end' };
}
