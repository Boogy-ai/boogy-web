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
export { InlineEdit } from './inline-edit';
export type { InlineEditProps } from './inline-edit';
export { Swatch } from './swatch';
export type { SwatchProps } from './swatch';
export { Tabs } from './tabs';
export type { TabsProps, TabItem } from './tabs';
export type { ButtonProps } from './button';
export { Popover } from './popover';
export type { PopoverProps } from './popover';
export { Dropdown } from './dropdown';
export type { DropdownProps, DropdownPopoverProps, DropdownMenuProps, DropdownItemProps } from './dropdown';
export { Stack } from './stack';
export { Card, CardGrid } from './card';
export type { CardProps } from './card';
export { Carousel } from './carousel';
export type { CarouselProps, CarouselImage } from './carousel';
export { TagList } from './tag-list';
export type { StackProps } from './stack';
export { Thumbnail } from './thumbnail';
export type { ThumbnailProps } from './thumbnail';
export { Tile, TileGrid } from './tile';
export type { TileProps } from './tile';
export { List, ListItem } from './list';
export type { ListItemProps } from './list';
export { Section } from './section';
export type { SectionProps } from './section';
export { Notice } from './notice';
export type { NoticeProps } from './notice';
export { InfoList } from './info-list';
export type { InfoItem } from './info-list';
export { DetailHeader } from './detail-header';
export type { DetailHeaderProps } from './detail-header';
export { SearchField } from './search-field';
export { EmptyState } from './empty-state';
export { Bubble, Thread } from './bubble';
export type { BubbleProps, ThreadProps } from './bubble';
export { Composer } from './composer';
export type { ComposerProps } from './composer';
export { Avatar } from './avatar';
export type { AvatarProps } from './avatar';
export { SeededArt } from './seeded-art';
export type { SeededArtProps } from './seeded-art';
export type { EmptyStateProps } from './empty-state';
export { Sheet } from './sheet';
export type { SheetProps } from './sheet';
export { useZoom, ZoomControls } from './zoom';
export type { ZoomControlsProps } from './zoom';
export { TextField } from './text-field';
export type { TextFieldProps } from './text-field';
export type { SearchFieldProps } from './search-field';
