// <Notice>: one line explaining the state of what is around it.
import type { JSX } from 'preact';
import { notice, type NoticeTone } from '@boogy/web';

export type NoticeProps = { tone?: NoticeTone } & JSX.HTMLAttributes<HTMLParagraphElement>;

export function Notice({ tone, children, ...rest }: NoticeProps) {
  return <p role="status" {...rest} {...notice({ tone })}>{children}</p>;
}
