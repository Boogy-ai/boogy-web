// Popover: a panel anchored to a trigger, above everything else on the page.
// The placement rules are React Aria's (the primitive under HeroUI v3's
// Popover and Dropdown), ported to the viewport: the popover lives in the
// browser's top layer, so its boundary is always the viewport.
//
//   1. `placement` is "side align": `bottom` (default), `bottom start`,
//      `top end`, `right`, `left top`, ...
//   2. It sits `offset` px off the trigger (default 8), `crossOffset` px along
//      it (default 0).
//   3. FLIP: when it is bigger than the room on its side, it tries the
//      OPPOSITE side and takes it only if that side has more room. Never a
//      perpendicular side.
//   4. SHIFT: along the cross axis it slides back inside the viewport, keeping
//      `containerPadding` px clear (default 12).
//   5. HEIGHT: `maxHeight` is the room left in the direction it grows, so a
//      tall popover scrolls instead of leaving the screen.

export type PopoverSide = 'top' | 'bottom' | 'left' | 'right';
export type PopoverAlign = 'start' | 'center' | 'end';
type SideWord = PopoverSide | 'start' | 'end';
type AlignWord = 'start' | 'end' | 'top' | 'bottom' | 'left' | 'right';
export type PopoverPlacement = SideWord | `${SideWord} ${AlignWord}`;

/** Where the popover renders: next to its trigger, or as a full-screen page. */
export type PopoverMode = 'anchored' | 'page';

export interface Rect { left: number; top: number; width: number; height: number }
export interface Size { width: number; height: number }

export interface PlaceOptions {
  trigger: Rect;
  popup: Size;
  viewport: Size;
  placement?: PopoverPlacement;
  offset?: number;
  crossOffset?: number;
  shouldFlip?: boolean;
  containerPadding?: number;
  maxHeight?: number;
}

export interface Placed {
  x: number;
  y: number;
  /** The side it actually landed on, after any flip. */
  placement: PopoverSide;
  maxHeight: number;
}

const OPPOSITE: Record<PopoverSide, PopoverSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/** "side align" → a side and an alignment along it. `start`/`end` as a SIDE are
 *  left/right (a left-to-right document); as an alignment, the named edge of
 *  the trigger (`top`/`left` = start, `bottom`/`right` = end). */
export function parsePlacement(placement: PopoverPlacement): { side: PopoverSide; align: PopoverAlign } {
  const [s, a] = placement.split(' ') as [SideWord, AlignWord | undefined];
  const side: PopoverSide = s === 'start' ? 'left' : s === 'end' ? 'right' : s;
  const align: PopoverAlign =
    a === 'start' || a === 'top' || a === 'left' ? 'start'
      : a === 'end' || a === 'bottom' || a === 'right' ? 'end'
        : 'center';
  return { side, align };
}

export function place(o: PlaceOptions): Placed {
  const { trigger: t, viewport: v } = o;
  const { side: preferred, align } = parsePlacement(o.placement ?? 'bottom');
  const offset = o.offset ?? 8;
  const crossOffset = o.crossOffset ?? 0;
  const pad = o.containerPadding ?? 12;
  const flip = o.shouldFlip ?? true;
  const vertical = (s: PopoverSide) => s === 'top' || s === 'bottom';

  const room = (s: PopoverSide) => Math.max(0,
    s === 'bottom' ? v.height - (t.top + t.height) - offset - pad
      : s === 'top' ? t.top - offset - pad
        : s === 'right' ? v.width - (t.left + t.width) - offset - pad
          : t.left - offset - pad);
  const main = (s: PopoverSide, size: Size) =>
    s === 'bottom' ? t.top + t.height + offset
      : s === 'top' ? t.top - offset - size.height
        : s === 'right' ? t.left + t.width + offset
          : t.left - offset - size.width;
  const cross = (s: PopoverSide, size: Size) => {
    const [start, tl, pl] = vertical(s) ? [t.left, t.width, size.width] : [t.top, t.height, size.height];
    return start + crossOffset + (align === 'center' ? (tl - pl) / 2 : align === 'end' ? tl - pl : 0);
  };
  // Slide back inside [pad, limit - pad]; a popup longer than that keeps its start edge.
  const shift = (at: number, len: number, limit: number) =>
    at < pad ? pad : at + len > limit - pad ? Math.max(limit - pad - len, pad) : at;

  let side = preferred;
  const need = vertical(side) ? o.popup.height : o.popup.width;
  if (flip && need > room(side) && room(OPPOSITE[side]) > room(side)) side = OPPOSITE[side];

  const layout = (size: Size) => {
    const c = shift(cross(side, size), vertical(side) ? size.width : size.height, vertical(side) ? v.width : v.height);
    return vertical(side) ? { x: c, y: main(side, size) } : { x: main(side, size), y: c };
  };

  let size = { ...o.popup };
  let at = layout(size);
  // The direction it grows decides what its height is measured against.
  const growsUp = side === 'top' || (!vertical(side) && align === 'end');
  let maxHeight = Math.max(0, growsUp ? at.y + size.height - pad : v.height - at.y - pad);
  if (o.maxHeight !== undefined && o.maxHeight < maxHeight) maxHeight = o.maxHeight;

  if (size.height > maxHeight) {
    size = { ...size, height: maxHeight };
    at = layout(size);
  }
  return { x: at.x, y: at.y, placement: side, maxHeight };
}

export interface PopoverAttrs {
  'data-boogy': 'popover';
  'data-mode': PopoverMode;
  'data-placement'?: PopoverSide;
}

export function popover(opts: { mode: PopoverMode; placement?: PopoverSide }): PopoverAttrs {
  const attrs: PopoverAttrs = { 'data-boogy': 'popover', 'data-mode': opts.mode };
  if (opts.placement) attrs['data-placement'] = opts.placement;
  return attrs;
}
