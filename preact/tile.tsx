// <TileGrid> and <Tile>: a grid of cards to choose from.
import { h, type ComponentChildren, type JSX } from 'preact';
import { tile, tileGrid } from '@boogy/web';

export function TileGrid({ children, ...rest }: JSX.HTMLAttributes<HTMLUListElement>) {
  return <ul {...rest} {...tileGrid()}>{children}</ul>;
}

export type TileProps = {
  /** `button` or `a` when the tile itself is the control. Default `div`. */
  as?: 'button' | 'a' | 'div';
  media?: ComponentChildren;
  title: ComponentChildren;
  subtitle?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLElement>, 'title'>;

/** One card, in its own grid item. */
export function Tile({ as = 'div', media, title, subtitle, ...rest }: TileProps) {
  const typed = as === 'button' ? { type: 'button' } : {};
  return (
    <li>
      {h(as, { ...typed, ...(rest as object), ...tile() },
        media != null && <span data-slot="media">{media}</span>,
        <span data-slot="title">{title}</span>,
        subtitle != null && <span data-slot="subtitle">{subtitle}</span>,
      )}
    </li>
  );
}
