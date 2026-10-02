// <EmptyState>: a region with nothing in it yet — a graphic, a title, a line
// saying what belongs here (children), and the action that adds the first
// thing, centred in the space the region has.
import type { ComponentChildren, JSX } from 'preact';
import { emptyState } from '@boogy/web';

export type EmptyStateProps = {
  /** The graphic, usually an icon drawn at 1em. Decorative: hidden from
   *  assistive technology, so the title must say what it shows. */
  media?: ComponentChildren;
  title: ComponentChildren;
  /** The action that adds the first thing, usually a button. */
  action?: ComponentChildren;
  /** The line saying what belongs here. */
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'title'>;

export function EmptyState({ media, title, action, children, ...rest }: EmptyStateProps) {
  return (
    <div {...rest} {...emptyState()}>
      {media !== undefined && <div data-slot="media" aria-hidden="true">{media}</div>}
      <p data-slot="title">{title}</p>
      {children !== undefined && <p data-slot="description">{children}</p>}
      {action !== undefined && <div data-slot="action">{action}</div>}
    </div>
  );
}
