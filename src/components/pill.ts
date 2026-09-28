// Pill: an inline-flex box that centres its content both ways, in a fully
// rounded shape. A layout container — its children are the content — whose
// look is chosen by ONE variant. Each variant defines all of its own states
// (hover, keyboard focus, pointer-down, pressed, disabled) in CSS; an app picks
// a variant for its own state and never restyles the pill from outside.

export const PILL_VARIANTS = ['solid', 'transparent', 'ghost'] as const;

/**
 * - `solid`: a filled ground from the theme, stronger on hover and pointer-down,
 *   accent when `aria-pressed="true"`.
 * - `transparent`: no shape in any state except a keyboard focus ring.
 * - `ghost`: no shape at rest; the solid shape on its own hover and keyboard
 *   focus. For a control that should stay quiet until it is pointed at.
 */
export type PillVariant = (typeof PILL_VARIANTS)[number];

export interface PillOptions {
  variant?: PillVariant;
}

export interface PillAttrs {
  'data-boogy': 'pill';
  'data-variant': PillVariant;
}

export function pill(opts: PillOptions = {}): PillAttrs {
  const variant = opts.variant ?? 'solid';
  if (!PILL_VARIANTS.includes(variant)) {
    throw new Error(`pill(): variant must be one of ${PILL_VARIANTS.join(', ')}, got "${variant}"`);
  }
  return { 'data-boogy': 'pill', 'data-variant': variant };
}
