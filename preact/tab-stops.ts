/** What Tab reaches inside a subtree: a selector for its TAB STOPS. A roving
 *  group (tabs, a swatch grid) keeps all but its current item at tabindex -1,
 *  so focus moved into a surface lands on that item, and a focus trap's first
 *  and last are where Tab really starts and ends. */
export const TAB_STOPS = ['a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]']
  .map((s) => `${s}:not([tabindex="-1"])`).join(', ');

/** Keep Tab inside `el`: from its last tab stop to its first, and Shift+Tab
 *  from its first to its last. Any other key, or Tab anywhere else, is left
 *  to the browser. */
export function trapTab(e: KeyboardEvent, el: HTMLElement): void {
  if (e.key !== 'Tab') return;
  const items = Array.from(el.querySelectorAll<HTMLElement>(TAB_STOPS));
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
}
