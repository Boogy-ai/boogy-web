// <Thread> and <Bubble>: a conversation. A thread is a labelled log of
// bubbles; a bubble is one message on one side of it — `start` for the other
// person's, `end` for your own — with its time (`meta`) beneath.
import type { ComponentChildren, JSX } from 'preact';
import { bubble, thread, type BubbleSide } from '@boogy/web';
import { DeliveryMark, type DeliveryStatus } from './delivery';

export type ThreadProps = {
  /** The thread's accessible name ("Messages with carol"). */
  label: string;
  /** Every bubble in it casts a subtle shadow: for a thread over a busy background. */
  shadow?: boolean;
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'label'>;

/** A log: assistive tech announces a bubble added to it. */
export function Thread({ label, shadow, children, ...rest }: ThreadProps) {
  return <div {...rest} {...thread({ shadow })} role="log" aria-label={label}>{children}</div>;
}

export type BubbleProps = {
  side?: BubbleSide;
  /** Beneath the text: its time, say. */
  meta?: ComponentChildren;
  /** Your own message's delivery — sent, delivered or seen — marked after `meta`. */
  status?: DeliveryStatus;
  /** What the reader can do to this message (delete it, say), at the end of
   *  its meta line. Where a mouse can hover they show on hover or focus; on
   *  touch, always. */
  actions?: ComponentChildren;
  /** The message's text; its line breaks are kept. */
  children?: ComponentChildren;
} & JSX.HTMLAttributes<HTMLDivElement>;

export function Bubble({ side, meta, status, actions, children, ...rest }: BubbleProps) {
  return (
    <div {...rest} {...bubble({ side })}>
      <div data-slot="body">{children}</div>
      {(meta != null || status || actions != null) && (
        <div data-slot="meta">
          {meta}
          {status && <DeliveryMark status={status} />}
          {actions != null && actions !== false && <span data-slot="actions">{actions}</span>}
        </div>
      )}
    </div>
  );
}
