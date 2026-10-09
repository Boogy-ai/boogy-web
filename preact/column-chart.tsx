import type { JSX } from 'preact';
import { columnChart, columnHeights, columnTable, segmentText, type ChartColumn } from '@boogy/web';

export type ColumnChartProps = {
  caption: string;
  /** The hidden table's heading over the columns' labels, in the app's words
   *  ("When", "Day"). */
  labelHeader: string;
  columns: readonly ChartColumn[];
  startLabel: string;
  endLabel: string;
} & JSX.HTMLAttributes<HTMLElement>;

/** Stacked columns over an ordered series. See `columnChart()`. */
export function ColumnChart({ caption, labelHeader, columns, startLabel, endLabel, ...rest }: ColumnChartProps) {
  const { heights, gaps } = columnHeights(columns);
  const { kinds, rows } = columnTable(columns);
  return (
    <figure {...rest} {...columnChart()}>
      <div data-slot="columns" aria-hidden="true">
        {columns.map((c, i) => (
          // A pointer reads a column's values from its title; a screen reader
          // reads them from the table below.
          <span key={i} data-slot="column" title={`${c.label}: ${segmentText(c.segments)}`}>
            {c.segments.map((s, j) =>
              // An empty segment draws nothing, so it never adds a gap or takes
              // the rounded top from the segment above it.
              heights[i][j] > 0 ? (
                <span
                  key={j}
                  data-slot="segment"
                  data-pattern={s.pattern ?? 'solid'}
                  style={{ '--segment-color': s.color, height: `calc((100% - var(--chart-segment-gap) * ${Math.max(0, gaps)}) * ${heights[i][j] / 100})` } as JSX.CSSProperties}
                />
              ) : null,
            )}
          </span>
        ))}
      </div>
      <div data-slot="axis" aria-hidden="true"><span>{startLabel}</span><span>{endLabel}</span></div>
      {/* Hidden by a box around it, not on the table: some engines lay a
          table's caption outside the table's own box, where a clip on the
          table would leave it drawn over the chart. */}
      <div data-visually-hidden="">
        <table>
          <caption>{caption}</caption>
          <thead><tr><th scope="col">{labelHeader}</th>{kinds.map((k, j) => <th key={j} scope="col">{k}</th>)}</tr></thead>
          <tbody>
            {columns.map((c, i) => (
              <tr key={i}><th scope="row">{c.label}</th>{rows[i].map((v, j) => <td key={j}>{v}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
