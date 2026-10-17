// <Panel>: a framed region with a head that stays put, a body that scrolls,
// and an optional foot (see `panel()`).
import type { ComponentChildren, JSX } from 'preact';
import { panel } from '@boogy/web';

export type PanelProps = {
  /** The region's name, for assistive technology. */
  label: string;
  /** Kept at the top while the body scrolls: a `Section` with no children
   *  (its title, count and action), a search field. */
  head?: ComponentChildren;
  /** Kept at the bottom while the body scrolls: actions. */
  foot?: ComponentChildren;
  /** Take the space its column leaves, rather than being as tall as its content. */
  grow?: boolean;
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLElement>, 'label'>;

const given = (c: ComponentChildren) => c != null && c !== false;

export function Panel({ label, head, foot, grow, children, ...rest }: PanelProps) {
  return (
    <section {...rest} {...panel({ grow })} aria-label={label}>
      {given(head) && <div data-slot="head">{head}</div>}
      <div data-slot="body">{children}</div>
      {given(foot) && <div data-slot="foot">{foot}</div>}
    </section>
  );
}
