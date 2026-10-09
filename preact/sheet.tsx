// <Sheet>: a page that fills the window — a titled head, a body that alone
// scrolls, and a foot that keeps its actions in view at the bottom.
import type { ComponentChildren, JSX } from 'preact';
import { sheet } from '@boogy/web';
import { BackButton } from './back-button';

export type SheetProps = {
  /** The page's heading, in the head. No head without it. It may carry
   *  media beside its text (an avatar by a name). */
  title?: ComponentChildren;
  /** A control before the title, in the head. */
  start?: ComponentChildren;
  /** A Back button before the title, calling this. */
  onBack?: () => void;
  /** The Back button's name. Default "Back". */
  backLabel?: string;
  /** A bar of controls at the end of the head. */
  end?: ComponentChildren;
  /** A head of the caller's own (a bar of its own, say), in place of the
   *  title, the Back and the end: it keeps the head's frame. */
  head?: ComponentChildren;
  /** The page's actions (OK / Cancel, say), held at the bottom. No foot
   *  without it. */
  foot?: ComponentChildren;
  /** The body. */
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'title'>;

export function Sheet({ title, start, onBack, backLabel, end, head, foot, children, ...rest }: SheetProps) {
  return (
    <div {...rest} {...sheet()}>
      {head !== undefined && <header data-slot="head" data-head="own">{head}</header>}
      {head === undefined && title !== undefined && (
        <header data-slot="head">
          {onBack && <BackButton label={backLabel} onClick={onBack} />}
          {start}
          <h1 data-slot="title">{title}</h1>
          {end !== undefined && <div data-slot="end">{end}</div>}
        </header>
      )}
      <div data-slot="body">{children}</div>
      {foot !== undefined && <footer data-slot="foot">{foot}</footer>}
    </div>
  );
}
