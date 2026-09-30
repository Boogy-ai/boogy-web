// Card: a summary of one thing — media and a title with a subtitle, a short
// summary, caption lines, and a foot for its actions. CardGrid lays cards out
// in as many columns as fit, never more than three.
export interface CardAttrs { 'data-boogy': 'card' }
export function card(): CardAttrs { return { 'data-boogy': 'card' }; }
/** `spaced`: separate cards with gaps between. `flush`: cards abut on hairline
 *  dividers — no gaps, square corners, no outer frame — the way panes tile. */
export const CARD_GRID_VARIANTS = ['spaced', 'flush'] as const;
export type CardGridVariant = (typeof CARD_GRID_VARIANTS)[number];
export interface CardGridAttrs { 'data-boogy': 'card-grid'; 'data-variant': CardGridVariant }
export function cardGrid(opts: { variant?: CardGridVariant } = {}): CardGridAttrs {
  const variant = opts.variant ?? 'spaced';
  if (!CARD_GRID_VARIANTS.includes(variant)) {
    throw new Error(`cardGrid(): variant must be one of ${CARD_GRID_VARIANTS.join(', ')}, got "${variant}"`);
  }
  return { 'data-boogy': 'card-grid', 'data-variant': variant };
}
