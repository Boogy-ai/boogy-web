// Panel: a framed region of a page with a head that stays put, a body that is
// the only part to scroll, and an optional foot. A list that grows goes in a
// panel's body, so it scrolls in its own place and never pushes the rest of
// the page down; a form goes in a panel of its own, as tall as its content.
// In a grid cell or a column with a height, a panel is that height and its
// body scrolls inside it; with `grow` it takes what its column leaves. In a
// board it is frosted, so the board shows through it, blurred.

export interface PanelOptions {
  /** Take the space its column leaves (a flex column), rather than being as
   *  tall as its content. */
  grow?: boolean;
}

export interface PanelAttrs {
  'data-boogy': 'panel';
  'data-grow'?: 'true';
}

export function panel(opts: PanelOptions = {}): PanelAttrs {
  const attrs: PanelAttrs = { 'data-boogy': 'panel' };
  if (opts.grow) attrs['data-grow'] = 'true';
  return attrs;
}
