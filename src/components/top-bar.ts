// TopBar: the bar across the top of a surface.
//
// - The start side is the title area: an optional leading control (a Back or
//   Home), the title, which ends in an ellipsis rather than wrapping, and an
//   optional short line under it.
// - The end side holds actions and widgets. Each has a priority (1 stays
//   longest). When they do not fit beside the title area, the lowest priority
//   (the highest number) moves first into a "More" menu, the later of a tie
//   first, and a lower priority never stays in place of a higher one.
// - Where an item goes: `auto` (the bar while it fits, else the menu), `bar`
//   (always the bar) or `menu` (always the menu). An action defaults to
//   `auto`; a widget (a group of controls, such as size buttons) to `menu`,
//   where it is a labelled row.
// - The size control (the page's zoom) is built in: in the menu by default,
//   in the bar, or left out.
// - The More button shows whenever the menu holds anything. In the menu, Up
//   and Down move between rows (wrapping at the ends), Left, Right and Tab
//   between the controls of a widget's row, and Tab past them (or on a plain
//   item) closes it.

import { moveFocus } from './menu';

export type TopBarPlace = 'auto' | 'bar' | 'menu';

export interface TopBarAttrs {
  'data-boogy': 'top-bar';
}

export function topBar(): TopBarAttrs {
  return { 'data-boogy': 'top-bar' };
}

export interface BarItemFit {
  id: string;
  priority: number;
  place: TopBarPlace;
  /** Its width in the bar, in pixels. */
  width: number;
}

/** The order items leave and come back in: priority, then the caller's order. */
function byImportance<T extends { priority: number }>(items: readonly T[]): T[] {
  return items.map((it, i) => ({ it, i })).sort((a, b) => a.it.priority - b.it.priority || a.i - b.i).map((x) => x.it);
}

/** The ids shown in the bar, given the room the items have (`available`),
 *  the More button's width and the gap between items. */
export function fitTopBar(items: readonly BarItemFit[], available: number, moreWidth: number, gap: number): Set<string> {
  const pinned = items.filter((it) => it.place === 'bar');
  const auto = byImportance(items.filter((it) => it.place === 'auto'));
  const width = (shown: readonly BarItemFit[], more: boolean) => {
    const n = shown.length + (more ? 1 : 0);
    return shown.reduce((sum, it) => sum + it.width, 0) + (more ? moreWidth : 0) + Math.max(0, n - 1) * gap;
  };
  const menuOnly = items.some((it) => it.place === 'menu');
  if (!menuOnly && width([...pinned, ...auto], false) <= available) return new Set([...pinned, ...auto].map((it) => it.id));
  const kept = [...pinned];
  for (const it of auto) {
    if (width([...kept, it], true) > available) break;
    kept.push(it);
  }
  return new Set(kept.map((it) => it.id));
}

/** The menu's rows: every item not in the bar, most important first. */
export function menuRows(items: readonly { id: string; priority: number }[], inBar: ReadonlySet<string>): string[] {
  return byImportance(items.filter((it) => !inBar.has(it.id))).map((it) => it.id);
}

export type RowMove = { row: number; col: number } | 'close' | null;

/** Where a key moves focus among the menu's rows, from `at` (`row: -1` when
 *  none is focused). `rows` holds each row's number of controls: 1 for a plain
 *  item, more for a widget's row. */
export function moveInRows(key: string, shift: boolean, at: { row: number; col: number }, rows: readonly number[]): RowMove {
  const last = rows.length - 1;
  if (last < 0) return null;
  switch (key) {
    // Between rows, as the SDK's menu moves between its items, wrapping.
    case 'ArrowDown':
    case 'ArrowUp':
    case 'Home':
    case 'End':
      return { row: moveFocus(key, at.row, rows.length, true)!, col: 0 };
    case 'ArrowRight': return at.row < 0 ? null : { row: at.row, col: Math.min(at.col + 1, rows[at.row] - 1) };
    case 'ArrowLeft': return at.row < 0 ? null : { row: at.row, col: Math.max(at.col - 1, 0) };
    case 'Tab': {
      if (at.row < 0) return 'close';
      const col = at.col + (shift ? -1 : 1);
      return col < 0 || col >= rows[at.row] ? 'close' : { row: at.row, col };
    }
    default: return null;
  }
}
