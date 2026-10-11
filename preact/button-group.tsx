// <ButtonGroup>: buttons joined into one partitioned shape, over the core
// `buttonGroup()`. Its children are the caller's own Buttons, left as they are.
import type { ComponentChildren, JSX } from 'preact';
import { buttonGroup } from '@boogy/web';

export type ButtonGroupProps = {
  /** The group's name, for assistive tech. */
  label: string;
  /** Round the outer ends fully. */
  rounded?: boolean;
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'label' | 'children'>;

export function ButtonGroup({ label, rounded, children, ...rest }: ButtonGroupProps) {
  return (
    <div {...rest} {...buttonGroup({ rounded })} aria-label={label}>
      {children}
    </div>
  );
}
