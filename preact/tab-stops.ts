/** What Tab reaches inside a subtree: a selector for its TAB STOPS. A roving
 *  group (tabs, a swatch grid) keeps all but its current item at tabindex -1,
 *  so focus moved into a surface lands on that item, and a focus trap's first
 *  and last are where Tab really starts and ends. */
export const TAB_STOPS = ['a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]']
  .map((s) => `${s}:not([tabindex="-1"])`).join(', ');
