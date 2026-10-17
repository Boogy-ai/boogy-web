// <Button>: the base action control for Preact apps, over the core `button()`.
import type { ComponentChildren, JSX, Ref } from 'preact';
import { forwardRef } from 'preact/compat';
import { button, type ButtonShape, type ButtonSize, type ButtonVariant } from '@boogy/web';
import { Glyph, type GlyphShape } from './glyphs';

type ButtonElement = 'button' | 'a';

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Fully rounded, whatever the variant. */
  rounded?: boolean;
  /** Take the whole width of its container. */
  fill?: boolean;
  /** An SDK glyph before the label, sized to the button. The label stays the
   *  button's name; for a glyph alone use `shape="icon"` with a `label`. */
  glyph?: GlyphShape;
  children?: ComponentChildren;
};

/** An icon-only button must say what it does: `label` becomes its accessible
 *  name and its tooltip. A text button's own text is its name. */
type ShapeProps =
  | { shape: 'icon'; label: string }
  | { shape?: Exclude<ButtonShape, 'icon'>; label?: string };

export type ButtonProps<T extends ButtonElement = 'button'> = { as?: T } & Common & ShapeProps &
  Omit<JSX.IntrinsicElements[T], 'as' | 'label' | 'size' | 'ref'>;

function ButtonImpl(props: ButtonProps<ButtonElement>, ref: Ref<HTMLElement>) {
  const { as, variant, size, rounded, fill, shape, label, glyph, children, ...rest } = props as ButtonProps<'button'>;
  const Tag = (as ?? 'button') as 'button';
  const named = label ? { 'aria-label': label, title: label } : {};
  const typed = Tag === 'button' ? { type: 'button' as const } : {};
  return (
    <Tag {...typed} {...(rest as object)} {...named} {...button({ variant, shape, size, rounded, fill })} ref={ref as Ref<HTMLButtonElement>}>
      {glyph && <Glyph shape={glyph} size={size === 'sm' ? 'sm' : 'md'} />}
      {children}
    </Tag>
  );
}

/** The ref reaches the rendered element, so a caller can focus or measure it. */
export const Button = forwardRef(ButtonImpl) as unknown as <T extends ButtonElement = 'button'>(
  props: ButtonProps<T> & { ref?: Ref<HTMLElement> },
) => JSX.Element;
