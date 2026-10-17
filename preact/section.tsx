// <Section>: a small caption heading over a group, with an optional action.
import type { ComponentChildren, JSX } from 'preact';
import { section } from '@boogy/web';
import { Glyph, type GlyphShape } from './glyphs';

export type SectionProps = {
  title: ComponentChildren;
  /** A short value that goes with the title, read with it ("Members · 3"). */
  meta?: ComponentChildren;
  /** Its mark, shown only where the heading has no room for its title: in a
   *  drawer folded to its strip, it stands over the meta in the title's place. */
  glyph?: GlyphShape;
  /** A line under the heading saying what the group is. */
  description?: ComponentChildren;
  action?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLElement>, 'title'>;

export function Section({ title, meta, glyph, description, action, children, ...rest }: SectionProps) {
  return (
    <section {...rest} {...section()}>
      <div data-slot="head">
        <h3 data-slot="header">
          {glyph && <Glyph shape={glyph} data-slot="glyph" />}
          <span data-slot="title">{title}</span>
          {meta != null && meta !== '' && (
            <span data-slot="meta"><span data-slot="separator" aria-hidden="true"> · </span>{meta}</span>
          )}
        </h3>
        {action}
        {description != null && description !== '' && <p data-slot="description">{description}</p>}
      </div>
      {children}
    </section>
  );
}
