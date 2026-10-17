// <Notice>: one line explaining the state of what is around it.
import type { ComponentChildren, JSX } from 'preact';
import { notice, type NoticeTone } from '@boogy/web';

export type NoticeProps = {
  tone?: NoticeTone;
  /** One thing to do about it ("Retry", "Unarchive"), at the end of its line. */
  action?: ComponentChildren;
} & JSX.HTMLAttributes<HTMLParagraphElement>;

export function Notice({ tone, action, children, ...rest }: NoticeProps) {
  return (
    <p role="status" {...rest} {...notice({ tone })}>
      {children}
      {action != null && action !== false && <span data-slot="action">{action}</span>}
    </p>
  );
}
