// Button: the base action control. One element (a real <button>, or a link
// styled as one), its icon and text as children, laid out inline-flex and
// centred. Its look is one `variant`, which owns every state (hover, keyboard
// focus, pointer-down, pressed, disabled); `shape`, `size` and `rounded` are
// independent of it.

export const BUTTON_VARIANTS = ['solid', 'quiet', 'danger', 'outline'] as const;
export const BUTTON_SHAPES = ['text', 'icon'] as const;
export const BUTTON_SIZES = ['sm', 'md', 'lg'] as const;

/** `solid`: the accent, for the primary action. `quiet`: no ground until
 *  hovered, for toolbar and icon buttons. `danger`: destructive actions.
 *  `outline`: a faint edge and no fill, for a secondary action that should be
 *  visible at rest (with `rounded` and `shape="icon"`, a circle). */
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];
/** `icon`: square, for an icon-only button (which needs an accessible label). */
export type ButtonShape = (typeof BUTTON_SHAPES)[number];
/** `md`: 2 units tall. `sm`: 1.5 units, for dense chrome such as a title bar.
 *  `lg`: 2.5 units, its text a step up, for the one main action of a surface. */
export type ButtonSize = (typeof BUTTON_SIZES)[number];

export interface ButtonOptions {
  variant?: ButtonVariant;
  shape?: ButtonShape;
  size?: ButtonSize;
  /** Fully rounded (a pill, or a circle when `shape` is `icon`), whatever the variant. */
  rounded?: boolean;
  /** Take the whole width of its container — a card's one action, say. */
  fill?: boolean;
}

export interface ButtonAttrs {
  'data-boogy': 'button';
  'data-variant': ButtonVariant;
  'data-shape': ButtonShape;
  'data-size': ButtonSize;
  'data-rounded'?: 'true';
  'data-fill'?: 'true';
}

function oneOf<T extends string>(what: string, value: T, allowed: readonly T[]): T {
  if (!allowed.includes(value)) {
    throw new Error(`button(): ${what} must be one of ${allowed.join(', ')}, got "${value}"`);
  }
  return value;
}

export function button(opts: ButtonOptions = {}): ButtonAttrs {
  const attrs: ButtonAttrs = {
    'data-boogy': 'button',
    'data-variant': oneOf('variant', opts.variant ?? 'quiet', BUTTON_VARIANTS),
    'data-shape': oneOf('shape', opts.shape ?? 'text', BUTTON_SHAPES),
    'data-size': oneOf('size', opts.size ?? 'md', BUTTON_SIZES),
  };
  if (opts.rounded) attrs['data-rounded'] = 'true';
  if (opts.fill) attrs['data-fill'] = 'true';
  return attrs;
}
