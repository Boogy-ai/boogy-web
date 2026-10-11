// Tabs: a row of tabs choosing which of several panels shows in one place.
// The row is a tablist and each tab a button that says whether it is selected.
// By default the tabs sit together at the start of the row; with `fill` they
// share the row's width evenly. The row and the panel can be shown apart (a
// row in a top bar over a page's body): the panel's id links them, each tab's
// id being `tabId(panel, its id)`.
// The row is ONE tab stop — the selected tab — and the arrow keys move between
// tabs, selecting as they go (wrapping round at either end); Home and End go to
// the first and last.

import { stepIndex } from './carousel';

/** The row and its panel together. */
export interface TabsAttrs {
  'data-boogy': 'tabs';
}

export function tabs(): TabsAttrs {
  return { 'data-boogy': 'tabs' };
}

export interface TabsOptions {
  /** The tabs share the row's width evenly, rather than sitting together at
   *  its start. */
  fill?: boolean;
}

/** The row of tabs. */
export interface TabListAttrs {
  'data-boogy': 'tab-list';
  role: 'tablist';
  'data-fill'?: 'true';
}

export function tabList(opts: TabsOptions = {}): TabListAttrs {
  return opts.fill
    ? { 'data-boogy': 'tab-list', role: 'tablist', 'data-fill': 'true' }
    : { 'data-boogy': 'tab-list', role: 'tablist' };
}

/** The selected tab's panel. */
export interface TabPanelAttrs {
  'data-boogy': 'tab-panel';
  role: 'tabpanel';
}

export function tabPanel(): TabPanelAttrs {
  return { 'data-boogy': 'tab-panel', role: 'tabpanel' };
}

/** A tab's element id, from its panel's id and its own: what the panel is
 *  labelled by, so a row and a panel shown apart stay linked. */
export const tabId = (panel: string, id: string): string => `${panel}--${id}`;

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
