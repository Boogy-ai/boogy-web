// SearchSelect: choose one item from a set that grows (rooms, people), where a
// radio per item would make a list as long as the set. A field whose trigger
// shows the choice; it opens a search over the items, read from the service a
// page at a time as the reader scrolls, never all at once. Its search drives
// the list as a combobox: the arrow keys move along it, Enter picks.

/** How long the search waits after the last key before it asks again. */
export const SEARCH_DELAY_MS = 250;

export interface SearchSelectAttrs {
  'data-boogy': 'search-select';
}

/** The open list: its search, then its results. */
export function searchSelect(): SearchSelectAttrs {
  return { 'data-boogy': 'search-select' };
}

/** The option an arrow key lands on, from `active` (-1: none) among `count`:
 *  Down from none is the first, Up from none the last, and each stops at its
 *  end. Any other key leaves it where it is, within the list. */
export function searchSelectStep(active: number, count: number, key: string): number {
  if (count <= 0) return -1;
  const at = Math.min(active, count - 1);
  if (key === 'ArrowDown') return at < 0 ? 0 : Math.min(at + 1, count - 1);
  if (key === 'ArrowUp') return at < 0 ? count - 1 : Math.max(at - 1, 0);
  return at;
}
