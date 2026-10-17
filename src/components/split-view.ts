// SplitView: a page's regions side by side when it is wide, and a row of tabs
// showing one region at a time when it is narrow. Wide or narrow is the
// layout's own width (a container query), never the window's: a pane in a
// board is narrow in a wide window. Below `collapseAt` it is tabs, each with
// its region's count. An `aside` region (a form and what it made, say) keeps
// its own width beside the main one. It fills the height it is given, so a
// growing Panel in a region scrolls inside it and the page never does.
//
// The breakpoints are the drawer's: one scale for every layout.

import { DRAWER_BREAKPOINTS } from './components-css';

export type SplitBreakpoint = keyof typeof DRAWER_BREAKPOINTS;

export interface SplitViewOptions {
  /** The width below which it is tabs: `sm`, `md` (the default) or `lg`. */
  collapseAt?: SplitBreakpoint;
}

export interface SplitViewAttrs {
  'data-boogy': 'split-view';
  'data-collapse-at': SplitBreakpoint;
}

export function splitView(opts: SplitViewOptions = {}): SplitViewAttrs {
  const collapseAt = opts.collapseAt ?? 'md';
  if (!(collapseAt in DRAWER_BREAKPOINTS)) {
    throw new Error(`splitView(): collapseAt must be one of ${Object.keys(DRAWER_BREAKPOINTS).join(', ')}, got "${collapseAt}"`);
  }
  return { 'data-boogy': 'split-view', 'data-collapse-at': collapseAt };
}
