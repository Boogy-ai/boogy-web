// Drawer: a side panel beside or over a main area. Framework-neutral
// attributes; the foundation's component stylesheet does the layout.
//
// Two modes, chosen by the LAYOUT's width (a container query, so it follows the
// space it is given, not the viewport):
// - docked, at or above the `collapseAt` breakpoint: a column beside the main
//   area, `expanded` (15 units) or collapsed to an icon strip (3.25 units);
// - overlay, below it: off-canvas, sliding over the main area when `open`.
// `expanded` and `open` are app state, kept separate because their right
// defaults differ (expanded on a desktop, closed on a phone). The current mode
// is readable from script as the `--boogy-drawer-mode` custom property on the
// drawer element (`docked` | `overlay`), so one toggle can drive both.
import { DRAWER_BREAKPOINTS } from './components-css';

export type DrawerBreakpoint = keyof typeof DRAWER_BREAKPOINTS;
export type DrawerSide = 'start' | 'end';

export interface DrawerLayoutOptions {
  side?: DrawerSide;
  collapseAt?: DrawerBreakpoint;
  expanded?: boolean;
  open?: boolean;
  /** Animate expanding, collapsing, opening and closing. Default true; false
   *  switches instantly (the states are unchanged, only the motion goes). */
  animate?: boolean;
}

export interface DrawerLayoutAttrs {
  'data-boogy': 'drawer-layout';
  'data-side': DrawerSide;
  'data-collapse-at': DrawerBreakpoint;
  'data-expanded': 'true' | 'false';
  'data-open': 'true' | 'false';
  'data-animate'?: 'false';
}

export function drawerLayout(opts: DrawerLayoutOptions = {}): DrawerLayoutAttrs {
  const collapseAt = opts.collapseAt ?? 'md';
  if (!(collapseAt in DRAWER_BREAKPOINTS)) {
    throw new Error(`drawerLayout(): collapseAt must be one of ${Object.keys(DRAWER_BREAKPOINTS).join(', ')}, got "${collapseAt}"`);
  }
  const attrs: DrawerLayoutAttrs = {
    'data-boogy': 'drawer-layout',
    'data-side': opts.side ?? 'start',
    'data-collapse-at': collapseAt,
    'data-expanded': opts.expanded === false ? 'false' : 'true',
    'data-open': opts.open ? 'true' : 'false',
  };
  if (opts.animate === false) attrs['data-animate'] = 'false';
  return attrs;
}

export const DRAWER_ITEM_VARIANTS = ['entry', 'title', 'framed'] as const;
/** `entry`: an ordinary navigation entry; its row (or, collapsed, its tile) is
 *  the surface. `title`: the drawer's heading entry (an app's name and mark),
 *  larger than the entries below it. `framed`: the mark is a small framed
 *  panel and the entry's only box — no row surface on hover or when current. */
export type DrawerItemVariant = (typeof DRAWER_ITEM_VARIANTS)[number];

export interface DrawerItemAttrs {
  'data-boogy': 'drawer-item';
  'data-variant': DrawerItemVariant;
  'aria-current'?: 'page';
}

export function drawerItem(opts: { current?: boolean; variant?: DrawerItemVariant } = {}): DrawerItemAttrs {
  const variant = opts.variant ?? 'entry';
  if (!DRAWER_ITEM_VARIANTS.includes(variant)) {
    throw new Error(`drawerItem(): variant must be one of ${DRAWER_ITEM_VARIANTS.join(', ')}, got "${variant}"`);
  }
  const attrs: DrawerItemAttrs = { 'data-boogy': 'drawer-item', 'data-variant': variant };
  if (opts.current) attrs['aria-current'] = 'page';
  return attrs;
}

/** The mode a drawer element is in right now, read from its stylesheet. */
export function drawerMode(drawer: Element): 'docked' | 'overlay' {
  return getComputedStyle(drawer).getPropertyValue('--boogy-drawer-mode').trim() === 'docked' ? 'docked' : 'overlay';
}

/** One or two letters standing for a label, for a collapsed drawer entry:
 *  the initials of the first two words, or the first two letters of one. */
export function monogram(label: string): string {
  const words = label.trim().split(/[\s\-_.]+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = (w: string) => Array.from(w)[0] ?? '';
  if (words.length >= 2) return (first(words[0]) + first(words[1])).toUpperCase();
  return Array.from(words[0]).slice(0, 2).join('');
}
