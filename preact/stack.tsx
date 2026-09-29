// <Stack>: children in a column, or in a row that wraps, a space token apart.
import { h, type ComponentChildren, type JSX } from 'preact';
import { stack, type StackDirection, type StackGap } from '@boogy/web';

export type StackProps = {
  /** The element it is. Default `div`. */
  as?: 'div' | 'article' | 'section' | 'ul';
  direction?: StackDirection;
  gap?: StackGap;
  children?: ComponentChildren;
} & JSX.HTMLAttributes<HTMLElement>;

export function Stack({ as = 'div', direction, gap, children, ...rest }: StackProps) {
  return h(as, { ...(rest as object), ...stack({ direction, gap }) }, children);
}
