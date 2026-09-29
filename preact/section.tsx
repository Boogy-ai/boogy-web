// <Section>: a small caption heading over a group, with an optional action.
import type { ComponentChildren, JSX } from 'preact';
import { section } from '@boogy/web';

export type SectionProps = { title: ComponentChildren; action?: ComponentChildren } & Omit<JSX.HTMLAttributes<HTMLElement>, 'title'>;

export function Section({ title, action, children, ...rest }: SectionProps) {
  return (
    <section {...rest} {...section()}>
      <div data-slot="head">
        <h3 data-slot="header">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
