// Menu: a list of actions or choices, the ARIA menu pattern as React Aria
// implements it (the primitive under HeroUI v3's Dropdown).
//
//   * An item's role follows the menu's selection mode: `menuitem` (none),
//     `menuitemradio` (single), `menuitemcheckbox` (multiple).
//   * Arrow keys move focus, stopping at the ends unless the menu wraps
//     (React Aria's `shouldFocusWrap`, default off); Home/End jump to the ends;
//     typing jumps to the next item whose text starts with what was typed
//     (`typeaheadSearch`, then `typeahead`).
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

/** How long a pause in typing ends a typeahead search. */
export const TYPEAHEAD_RESET_MS = 1000;

/** What has been typed into a menu's typeahead, and when last. */
export interface TypeaheadSearch {
  text: string;
  at: number;
}

/** Whether `target` takes keys for itself: a field, a select or editable
 *  text, where typing goes in and the arrow keys move within it. A menu
 *  around one leaves those keys to it. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && typeof el.matches === 'function' && (el.isContentEditable || el.matches('input, textarea, select'));
}

/** The search a key press at `now` leaves, or null when the key is no part of
 *  one: it types no character, or it has a modifier, or it is typed in a field
 *  (the field's own). A space continues a search already running, and
 *  otherwise presses the focused item, so it starts none. A pause longer than
 *  TYPEAHEAD_RESET_MS starts a new search. Find its item with `typeahead`. */
export function typeaheadSearch(
  search: TypeaheadSearch,
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target'>,
  now: number,
): TypeaheadSearch | null {
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return null;
  const fresh = search.text === '' || now - search.at > TYPEAHEAD_RESET_MS;
  if (e.key === ' ' && fresh) return null;
  return { text: (fresh ? '' : search.text) + e.key, at: now };
}

/** An item's text for typeahead: the text it gives (`data-text-value`), else
 *  its label slot's, else all of its own. */
export function menuItemText(el: HTMLElement): string {
  return el.dataset.textValue ?? el.querySelector('[data-slot="label"]')?.textContent ?? el.textContent ?? '';
}
