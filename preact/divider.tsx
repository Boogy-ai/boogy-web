// <Divider>: a hairline between groups of related controls. See `divider()`.
import type { JSX } from 'preact';
import { divider, type DividerOrientation } from '@boogy/web';

export type DividerProps = {
  /** Default vertical: between groups in a bar. */
  orientation?: DividerOrientation;
} & Omit<JSX.HTMLAttributes<HTMLSpanElement>, 'role' | 'children'>;

export function Divider({ orientation, ...rest }: DividerProps) {
  return <span {...rest} {...divider({ orientation })} />;
}
