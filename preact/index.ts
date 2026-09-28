// @boogy/web for Preact apps: thin components over the framework-neutral core.
// Each one renders ONE element — the layout box and, when `as` makes it one,
// the control — and takes its look from a single `variant`.
import { h, type ComponentChildren, type JSX } from 'preact';
import { pill, type PillVariant } from '@boogy/web';

type PillElement = 'span' | 'button' | 'a' | 'div';

/** Props are the element's own (a `button` takes `type`, an `a` takes `href`)
 *  plus `as` and `variant`. */
export type PillProps<T extends PillElement = 'span'> = {
  /** The element the pill is. `button` when the pill itself is the control. */
  as?: T;
  variant?: PillVariant;
  children?: ComponentChildren;
} & Omit<JSX.IntrinsicElements[T], 'as' | 'children'>;

/** An inline-flex box, centred both ways, in a pill shape. See `pill()`. */
export function Pill<T extends PillElement = 'span'>({ as, variant, children, ...rest }: PillProps<T>) {
  return h(as ?? 'span', { ...(rest as object), ...pill({ variant }) }, children);
}
export { DrawerLayout, Drawer, DrawerMain, DrawerItem, DrawerToggle } from './drawer';
export type { DrawerLayoutProps, DrawerProps, DrawerItemProps, DrawerToggleProps } from './drawer';
export { Button } from './button';
export type { ButtonProps } from './button';
export { Popover } from './popover';
export type { PopoverProps } from './popover';
export { Dropdown } from './dropdown';
export type { DropdownProps, DropdownPopoverProps, DropdownMenuProps, DropdownItemProps } from './dropdown';
