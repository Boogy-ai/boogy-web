// <List> and <ListItem>: rows with media, text, and at most one action.
import { h, type ComponentChildren, type JSX } from 'preact';
import { list, listItem } from '@boogy/web';

export function List({ children, ...rest }: JSX.HTMLAttributes<HTMLUListElement>) {
  return <ul {...rest} {...list()}>{children}</ul>;
}

export type ListItemProps = {
  /** `button` or `a` when the whole row is the control. Default `div`. */
  as?: 'button' | 'a' | 'div';
  media?: ComponentChildren;
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  description?: ComponentChildren;
  /** One trailing action. Not allowed when the row is itself a control. */
  end?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLElement>, 'title'>;

/** One row, in its own list item. */
export function ListItem({ as = 'div', media, title, subtitle, description, end, ...rest }: ListItemProps) {
  if (as !== 'div' && end != null) {
    throw new Error('ListItem: a row that is itself a control is one control — put an action in `end` only when `as` is "div".');
  }
  const typed = as === 'button' ? { type: 'button' } : {};
  return (
    <li>
      {h(as, { ...typed, ...(rest as object), ...listItem() },
        media != null && <span data-slot="media">{media}</span>,
        <span data-slot="text">
          <span data-slot="title">{title}</span>
          {subtitle != null && <span data-slot="subtitle">{subtitle}</span>}
          {description != null && <span data-slot="description">{description}</span>}
        </span>,
        end != null && <span data-slot="end">{end}</span>,
      )}
    </li>
  );
}
