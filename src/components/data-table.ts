// DataTable: a dense, semantic <table>.
//
// - A sticky header.
// - Numeric columns right-aligned in tabular figures.
// - At most one sortable header (aria-sort).
// - A priority per column (1 = kept longest). When the columns' minimum widths
//   do not fit the container, the lowest priority goes first, the rightmost
//   column of a priority first, and priority 1 never goes. It answers to its
//   container, not the window.
// - A control in a row's title cell covers the whole row.

export interface ColumnFit {
  priority: number;
  /** The column's minimum width, in pixels. */
  min: number;
}

export function visibleColumns(columns: readonly ColumnFit[], available: number): boolean[] {
  const keep = columns.map(() => true);
  let width = columns.reduce((sum, c) => sum + c.min, 0);
  const dropOrder = columns
    .map((c, i) => ({ ...c, i }))
    .filter((c) => c.priority > 1)
    .sort((a, b) => b.priority - a.priority || b.i - a.i);
  for (const c of dropOrder) {
    if (width <= available) break;
    keep[c.i] = false;
    width -= c.min;
  }
  return keep;
}

export interface DataTableAttrs {
  'data-boogy': 'data-table';
}

export function dataTable(): DataTableAttrs {
  return { 'data-boogy': 'data-table' };
}

export function sortState(direction?: 'ascending' | 'descending'): 'ascending' | 'descending' | 'none' {
  return direction ?? 'none';
}
