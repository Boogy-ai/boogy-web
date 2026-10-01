import type { JSX } from 'preact';
import { swatch } from '@boogy/web';

export type SwatchProps = {
  /** Any CSS colour, including a `var(...)` — resolved on the chip itself, so
   *  a custom property the chip's own attributes set is the one it shows. */
  color: string;
} & Omit<JSX.HTMLAttributes<HTMLSpanElement>, 'color' | 'style'>;

/** A round chip of one colour. See `swatch()`. */
export function Swatch({ color, ...rest }: SwatchProps) {
  return <span {...rest} {...swatch()} style={{ '--swatch-color': color } as JSX.CSSProperties} />;
}
