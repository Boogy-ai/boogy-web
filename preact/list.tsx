// <List> and <ListItem>: rows with media, text, and at most one action.
import { h, type ComponentChildren, type JSX } from 'preact';
import { list, listItem, type ListDensity, type ListVariant } from '@boogy/web';

export function List({ density, variant, children, ...rest }: {
  /** `compact`: one line per item, closer together (a sidebar's list). */
  density?: ListDensity;
  /** `nav`: rows of places to go, the `current` one filled with the accent. */
  variant?: ListVariant;
} & JSX.HTMLAttributes<HTMLUListElement>) {
  return <ul {...rest} {...list({ density, variant })}>{children}</ul>;
}

export type ListItemProps = {
  /** `button` or `a` when the whole row is the control. Default `div`. */
  as?: 'button' | 'a' | 'div';
  media?: ComponentChildren;
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  description?: ComponentChildren;
  /** Trailing information — a time, a count — on the title's line, at its
   *  end. Not a control, so a row that is itself one may have it. */
  meta?: ComponentChildren;
  /** One trailing action. Not allowed when the row is itself a control. */
  end?: ComponentChildren;
  /** With `as="a"`, the address the row links to. */
  href?: string;
  /** Something new in it the reader has not seen: a bolder title and an
   *  accent dot, and the word "unread" for a screen reader. */
  unread?: boolean;
  /** The one open now (the room being read): shown selected, and named so to
   *  assistive tech. */
  current?: boolean;
} & Omit<JSX.HTMLAttributes<HTMLElement>, 'title'>;

/** One row, in its own list item. */
export function ListItem({ as = 'div', media, title, subtitle, description, meta, end, unread = false, current = false, ...rest }: ListItemProps) {
  if (as !== 'div' && end != null) {
    throw new Error('ListItem: a row that is itself a control is one control — put an action in `end` only when `as` is "div".');
  }
  const typed = as === 'button' ? { type: 'button' } : {};
  return (
    <li>
      {h(as, { ...typed, ...(rest as object), ...listItem({ unread, current }) },
        media != null && <span data-slot="media">{media}</span>,
        <span data-slot="text">
          {meta != null || unread ? (
            <span data-slot="heading">
              <span data-slot="title">{title}{unread && <span data-visually-hidden> (unread)</span>}</span>
              {unread && <span data-slot="unread" aria-hidden="true" />}
              {meta != null && <span data-slot="meta">{meta}</span>}
            </span>
          ) : (
            <span data-slot="title">{title}</span>
          )}
          {subtitle != null && <span data-slot="subtitle">{subtitle}</span>}
          {description != null && <span data-slot="description">{description}</span>}
        </span>,
        end != null && <span data-slot="end">{end}</span>,
      )}
    </li>
  );
}
