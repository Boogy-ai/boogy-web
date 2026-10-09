// FillGrid: n children in the columns × rows that make each cell largest at a
// preferred width-to-height aspect.
//
// Every column count 1..n is scored as min(cell width, cell height × aspect).
// A shape whose cell is under the minimum is no candidate. The best score
// wins, and a tie goes to fewer empty cells, then to fewer columns. With no
// candidate left, the children fall back to one scrolling column at the
// minimum height. The container's size is all it answers to.

import { measureContentBox, observeSize, remeasureWithin, resolveLength, runRounds, type RoundJob } from './measure';
import type { FitHandle } from './fit-text';

export interface GridShape {
  cols: number;
  rows: number;
  fallback: boolean;
}

export interface MinCell {
  inline: number;
  block: number;
}

/** Scores closer than this many pixels are a tie. */
const TIE = 0.5;

export function fillGridShape(
  n: number,
  width: number,
  height: number,
  aspect: number,
  gap: number,
  min: MinCell = { inline: 0, block: 0 },
): GridShape {
  let best: { cols: number; rows: number; score: number; empty: number } | null = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cellW = (width - (cols - 1) * gap) / cols;
    const cellH = (height - (rows - 1) * gap) / rows;
    if (!(cellW > 0 && cellH > 0) || cellW < min.inline || cellH < min.block) continue;
    const score = Math.min(cellW, cellH * aspect);
    const empty = cols * rows - n;
    const better = !best || score > best.score + TIE || (Math.abs(score - best.score) <= TIE && empty < best.empty);
    if (better) best = { cols, rows, score, empty };
  }
  return best ? { cols: best.cols, rows: best.rows, fallback: false } : { cols: 1, rows: Math.max(n, 1), fallback: true };
}

export interface FillGridAttrs {
  'data-boogy': 'fill-grid';
}

export function fillGrid(): FillGridAttrs {
  return { 'data-boogy': 'fill-grid' };
}

export interface FillGridOptions {
  aspect: number;
  /** The smallest cell, as CSS lengths. */
  minInline: string;
  minBlock: string;
}

/** Keep `el`'s `--cols`, `--rows` and `data-fallback` right for its size and
 *  for `count()` children. Call `refit()` when the count or the gap changes:
 *  neither resizes the box. A new shape measures again, in the same batch,
 *  everything measured inside the grid (the text fitted in a cell). */
export function attachFillGrid(el: HTMLElement, count: () => number, opts: FillGridOptions): FitHandle {
  let min: MinCell = { inline: 0, block: 0 };
  let shape: GridShape = { cols: 1, rows: 1, fallback: false };
  let drawn: GridShape | null = null;
  const job: RoundJob = {
    el,
    start: () => {
      min = { inline: resolveLength(el, opts.minInline), block: resolveLength(el, opts.minBlock) };
    },
    write: () => {},
    read: () => {
      // The box the cells' percentages resolve against: the content box.
      const box = measureContentBox(el);
      const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
      shape = fillGridShape(count(), box.inline, box.block, opts.aspect, gap, min);
      return true;
    },
    finish: () => {
      el.style.setProperty('--cols', String(shape.cols));
      el.style.setProperty('--rows', String(shape.rows));
      el.dataset.fallback = String(shape.fallback);
      const moved = !drawn || drawn.cols !== shape.cols || drawn.rows !== shape.rows || drawn.fallback !== shape.fallback;
      drawn = shape;
      // Every cell has a new size, and the grid's box the same one.
      if (moved) remeasureWithin(el);
    },
  };
  const stop = observeSize(el, () => runRounds(job));
  return { refit: () => runRounds(job), detach: stop };
}
