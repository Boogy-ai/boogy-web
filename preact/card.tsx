// <CardGrid> and <Card>: a grid of summaries — three, two or one column as
// the container allows (see the stylesheet).
import type { ComponentChildren, JSX } from 'preact';
import { card, cardGrid, type CardGridVariant } from '@boogy/web';

export function CardGrid({ variant, children, ...rest }: { variant?: CardGridVariant } & JSX.HTMLAttributes<HTMLUListElement>) {
  return <ul {...rest} {...cardGrid({ variant })}>{children}</ul>;
}

export type CardProps = {
  /** Full-bleed media across the top, above the head — a Carousel, say. */
  cover?: ComponentChildren;
  media?: ComponentChildren;
  /** The title — plain text, or a button/link that then covers the whole card
   *  (its action in `footer` stays above it and keeps its own). */
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  /** A short description, clamped to three lines. */
  summary?: ComponentChildren;
  /** Caption lines under the summary, each on one line; empty ones are left out. */
  meta?: readonly ComponentChildren[];
  /** Actions, at the bottom of the card. */
  footer?: ComponentChildren;
  /** Anything else for the body, after the caption lines. */
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLElement>, 'title'>;

/** One card, in its own grid item. */
export function Card({ cover, media, title, subtitle, summary, meta = [], footer, children, ...rest }: CardProps) {
  const lines = meta.filter((m) => m != null && m !== '' && m !== false);
  const body = summary != null || lines.length > 0 || children != null;
  return (
    <li>
      <article {...rest} {...card()}>
        {cover != null && <div data-slot="cover">{cover}</div>}
        <div data-slot="head">
          {media != null && <span data-slot="media">{media}</span>}
          <div data-slot="heading">
            <span data-slot="title">{title}</span>
            {subtitle != null && subtitle !== '' && <span data-slot="subtitle">{subtitle}</span>}
          </div>
        </div>
        {body && (
          <div data-slot="body">
            {summary != null && <p data-slot="summary">{summary}</p>}
            {lines.map((m, i) => <p key={i} data-slot="meta">{m}</p>)}
            {children}
          </div>
        )}
        {footer != null && <div data-slot="foot">{footer}</div>}
      </article>
    </li>
  );
}
