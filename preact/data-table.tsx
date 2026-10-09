import type { ComponentChildren, JSX } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { dataTable, measureContentBox, measurePadding, observeSize, resolveLength, runRounds, sortState, visibleColumns, type RoundJob } from '@boogy/web';
import { Glyph } from './glyphs';

export interface DataColumn<T> {
  key: string;
  header: string;
  /** 1 is kept longest; higher numbers drop first as the box narrows. */
  priority: number;
  /** The narrowest the column may be, as a CSS length. */
  minWidth: string;
  numeric?: boolean;
  sortable?: boolean;
  cell(row: T): ComponentChildren;
}

export type DataTableProps<T> = {
  caption: string;
  columns: readonly DataColumn<T>[];
  rows: readonly T[];
  rowKey(row: T): string;
  /** The column whose cell is the row's header: its control covers the row. */
  titleKey: string;
  sort?: { key: string; direction: 'ascending' | 'descending' };
  onSort?(key: string): void;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'rows'>;

/** A dense, semantic table that drops low-priority columns to fit its box. See `dataTable()`. */
export function DataTable<T>({ caption, columns, rows, rowKey, titleKey, sort, onSort, ...rest }: DataTableProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<boolean[]>(() => columns.map(() => true));
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const jobRef = useRef<RoundJob | null>(null);
  useLayoutEffect(() => {
    const el = ref.current!;
    let next = columnsRef.current.map(() => true);
    const job: RoundJob = {
      el,
      start: () => {},
      write: () => {},
      // resolveLength appends a probe, a write inside the read phase. It runs
      // once per column per resize, on one table: the cost is accepted.
      // A column also needs its cells' inline padding: the larger of its
      // header cell's and its first body cell's, as an app may pad the two
      // apart (body rows share theirs, by rule). A hidden cell still computes
      // its padding.
      read: () => {
        const heads = el.querySelectorAll(':scope > table > thead > tr > th');
        const body = el.querySelector(':scope > table > tbody > tr');
        const pad = (cell: Element | null | undefined) => (cell ? measurePadding(cell).inline : 0);
        const fits = columnsRef.current.map((c, i) => ({
          priority: c.priority,
          min: resolveLength(el, c.minWidth) + Math.max(pad(heads[i]), pad(body?.children[i])),
        }));
        next = visibleColumns(fits, measureContentBox(el).inline);
        return true;
      },
      finish: () => setVisible(next),
    };
    jobRef.current = job;
    return observeSize(el, () => runRounds(job));
  }, []);
  // A changed set of columns, or a changed minimum, is fitted again.
  const shape = columns.map((c) => `${c.priority}:${c.minWidth}`).join(' ');
  const fitted = useRef(shape);
  useLayoutEffect(() => {
    if (fitted.current === shape) return;
    fitted.current = shape;
    if (jobRef.current) runRounds(jobRef.current);
  }, [shape]);
  // Until a fit has run for these columns, a column is shown.
  const shown = (i: number) => visible[i] !== false;
  return (
    <div ref={ref} {...rest} {...dataTable()}>
      <table>
        <caption data-visually-hidden="">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={c.key}
                scope="col"
                hidden={!shown(i)}
                data-numeric={c.numeric ? 'true' : undefined}
                aria-sort={c.sortable ? sortState(sort?.key === c.key ? sort.direction : undefined) : undefined}
              >
                {c.sortable && onSort ? (
                  <button type="button" onClick={() => onSort(c.key)}>
                    {c.header}
                    <Glyph shape="arrow-down" size="sm" data-slot="sort" />
                  </button>
                ) : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c, i) =>
                c.key === titleKey ? (
                  <th key={c.key} scope="row" data-slot="title" hidden={!shown(i)}>{c.cell(row)}</th>
                ) : (
                  <td key={c.key} hidden={!shown(i)} data-numeric={c.numeric ? 'true' : undefined}>{c.cell(row)}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
