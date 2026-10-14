import type { JSX } from 'preact';
import { sampleGrid } from '@boogy/web';
import { ChoiceGrid } from './choice-grid';

/** One sample: its id, its name, and how its tile is painted. */
export type Sample = { id: string; label: string; style?: JSX.CSSProperties };

export type SampleGridProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, 'onChange' | 'value' | 'rows'> & {
  /** The group's name ("Pattern"). */
  label: string;
  samples: readonly Sample[];
  /** The chosen sample's id; one no sample has chooses none. */
  value: string;
  /** A sample chosen. Only when the value changes. */
  onValueChange: (value: string) => void;
  /** Tiles per row. Default 4. */
  columns?: number;
  /** The rows it shows before it scrolls; a fraction shows part of the next
   *  one, which says there is more. `'all'`: every row, the grid as tall as
   *  its tiles (what holds it scrolls instead). Default 3. */
  rows?: number | 'all';
  /** Paint each tile only once it comes near the view: for a grid of many
   *  costly samples. Every tile is still there, named and reachable. */
  lazy?: boolean;
};

/** A grid of samples to choose one from. See `sampleGrid()`. */
export function SampleGrid({ label, samples, value, onValueChange, columns = 4, rows = 3, lazy, style, ...rest }: SampleGridProps) {
  const all = rows === 'all';
  return (
    <ChoiceGrid
      {...rest}
      {...sampleGrid()}
      data-rows={all ? 'all' : undefined}
      lazy={lazy}
      aria-label={label}
      style={{ '--sample-grid-columns': String(columns), ...(all ? {} : { '--sample-grid-rows': String(rows) }), ...(style as object) } as JSX.CSSProperties}
      tiles={samples}
      chosen={samples.findIndex((s) => s.id === value)}
      columns={columns}
      tileSlot="sample"
      onChoose={onValueChange}
    />
  );
}
