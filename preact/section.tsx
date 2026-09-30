// <Section>: a small caption heading over a group, with an optional action.
import type { ComponentChildren, JSX } from 'preact';
import { section } from '@boogy/web';

export type SectionProps = {
  title: ComponentChildren;
  /** A line under the heading saying what the group is. */
  description?: ComponentChildren;
  action?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLElement>, 'title'>;

export function Section({ title, description, action, children, ...rest }: SectionProps) {
  return (
    <section {...rest} {...section()}>
      <div data-slot="head">
        <h3 data-slot="header">{title}</h3>
        {action}
        {description != null && description !== '' && <p data-slot="description">{description}</p>}
      </div>
      {children}
    </section>
  );
}
