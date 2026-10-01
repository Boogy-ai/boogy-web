// Tabs: a row of tabs choosing which of several panels shows in one place.
// The row is a tablist and each tab a button that says whether it is selected.
// The row is ONE tab stop — the selected tab — and the arrow keys move between
// tabs, selecting as they go (wrapping round at either end); Home and End go to
// the first and last.

import { stepIndex } from './carousel';

export interface TabsAttrs {
  'data-boogy': 'tabs';
}

export function tabs(): TabsAttrs {
  return { 'data-boogy': 'tabs' };
}

export interface TabAttrs {
  'data-slot': 'tab';
  role: 'tab';
  type: 'button';
  'aria-selected': 'true' | 'false';
  tabIndex: 0 | -1;
}

export function tab(opts: { selected: boolean }): TabAttrs {
  return {
    'data-slot': 'tab',
    role: 'tab',
    type: 'button',
    'aria-selected': opts.selected ? 'true' : 'false',
    tabIndex: opts.selected ? 0 : -1,
  };
}

/** The tab a key moves to from tab `index` of `count`, or `null` when the key
 *  is not one the tabs handle. */
export function tabKey(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight': return stepIndex(index, 1, count);
    case 'ArrowLeft': return stepIndex(index, -1, count);
    case 'Home': return 0;
    case 'End': return Math.max(0, count - 1);
    default: return null;
  }
}
