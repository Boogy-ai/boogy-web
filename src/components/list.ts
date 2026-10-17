// List item: leading media, then a title, subtitle and one-line description,
// then an `end` slot for one action. The whole row may itself be the control;
// when it is, `end` holds no second control. Trailing information that is not
// a control (a time, a count) is `meta`: the title and it share a `heading`
// row, the meta at its end.
export interface ListAttrs { 'data-boogy': 'list'; 'data-density'?: 'compact'; 'data-variant'?: 'nav' }
/** `compact`: one line per item, closer together (a sidebar's list). */
export type ListDensity = 'normal' | 'compact';
/** `plain`: rows of things. `nav`: rows of places to go (a sidebar's rooms or
 *  pages), the one open now filled with the accent. */
export const LIST_VARIANTS = ['plain', 'nav'] as const;
export type ListVariant = (typeof LIST_VARIANTS)[number];
export function list({ density = 'normal', variant = 'plain' }: { density?: ListDensity; variant?: ListVariant } = {}): ListAttrs {
  if (!LIST_VARIANTS.includes(variant)) {
    throw new Error(`list(): variant must be one of ${LIST_VARIANTS.join(', ')}, got "${variant}"`);
  }
  const attrs: ListAttrs = { 'data-boogy': 'list' };
  if (density === 'compact') attrs['data-density'] = 'compact';
  if (variant === 'nav') attrs['data-variant'] = 'nav';
  return attrs;
}
export interface ListItemAttrs {
  'data-boogy': 'list-item';
  /** Something new in it the reader has not seen. */
  'data-unread'?: '';
  /** The one open now (the room being read). */
  'aria-current'?: 'page';
}
export function listItem({ unread = false, current = false }: { unread?: boolean; current?: boolean } = {}): ListItemAttrs {
  const attrs: ListItemAttrs = { 'data-boogy': 'list-item' };
  if (unread) attrs['data-unread'] = '';
  if (current) attrs['aria-current'] = 'page';
  return attrs;
}
