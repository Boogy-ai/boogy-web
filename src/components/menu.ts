// Menu: a list of actions or choices, the ARIA menu pattern as React Aria
// implements it (the primitive under HeroUI v3's Dropdown).
//
//   * An item's role follows the menu's selection mode: `menuitem` (none),
//     `menuitemradio` (single), `menuitemcheckbox` (multiple).
//   * Arrow keys move focus, stopping at the ends unless the menu wraps
//     (React Aria's `shouldFocusWrap`, default off); Home/End jump to the ends;
//     typing jumps to the next item whose text starts with what was typed.
//   * Disabled items are skipped by every one of these.

export type MenuSelectionMode = 'none' | 'single' | 'multiple';
export const MENU_ITEM_VARIANTS = ['default', 'danger'] as const;
/** `default`, or `danger` for a destructive action. */
export type MenuItemVariant = (typeof MENU_ITEM_VARIANTS)[number];

export interface MenuItemAttrs {
  'data-boogy': 'menu-item';
  'data-key': string;
  'data-variant': MenuItemVariant;
  role: 'menuitem' | 'menuitemradio' | 'menuitemcheckbox';
  tabIndex: -1;
  'aria-checked'?: 'true' | 'false';
  'aria-disabled'?: 'true';
  'data-selected'?: 'true';
  'data-disabled'?: 'true';
}

export function menuItem(opts: {
  id: string;
  selectionMode: MenuSelectionMode;
  selected?: boolean;
  disabled?: boolean;
  variant?: MenuItemVariant;
}): MenuItemAttrs {
  const variant = opts.variant ?? 'default';
  if (!MENU_ITEM_VARIANTS.includes(variant)) {
    throw new Error(`menuItem(): variant must be one of ${MENU_ITEM_VARIANTS.join(', ')}, got "${variant}"`);
  }
  const role = opts.selectionMode === 'single' ? 'menuitemradio' : opts.selectionMode === 'multiple' ? 'menuitemcheckbox' : 'menuitem';
  // Roving focus: items are focused by the menu, never tabbed to.
  const attrs: MenuItemAttrs = { 'data-boogy': 'menu-item', 'data-key': opts.id, 'data-variant': variant, role, tabIndex: -1 };
  if (role !== 'menuitem') attrs['aria-checked'] = opts.selected ? 'true' : 'false';
  if (opts.selected) attrs['data-selected'] = 'true';
  if (opts.disabled) {
    attrs['aria-disabled'] = 'true';
    attrs['data-disabled'] = 'true';
  }
  return attrs;
}

/** The index a navigation key moves focus to among `count` enabled items, from
 *  `index` (-1 when none is focused), or null for any other key. */
export function moveFocus(key: string, index: number, count: number, wrap: boolean): number | null {
  if (count === 0) return null;
  switch (key) {
    case 'Home': return 0;
    case 'End': return count - 1;
    case 'ArrowDown':
      if (index < 0) return 0;
      return index + 1 < count ? index + 1 : wrap ? 0 : index;
    case 'ArrowUp':
      if (index < 0) return count - 1;
      return index > 0 ? index - 1 : wrap ? count - 1 : index;
    default: return null;
  }
}

/** The item a typed prefix jumps to, searching round from `from`, or null.
 *  A single character starts AFTER the current item, so pressing it again
 *  cycles through the matches; a longer prefix includes the current item, so
 *  typing on through its name does not jump away from it. */
export function typeahead(labels: readonly string[], query: string, from: number): number | null {
  if (!query || labels.length === 0) return null;
  const q = query.toLowerCase();
  const start = query.length === 1 ? from + 1 : Math.max(from, 0);
  for (let i = 0; i < labels.length; i++) {
    const at = (start + i) % labels.length;
    if (labels[at].toLowerCase().startsWith(q)) return at;
  }
  return null;
}
