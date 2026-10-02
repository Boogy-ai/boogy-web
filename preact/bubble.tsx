// <Thread> and <Bubble>: a conversation. A thread is a labelled log of
// bubbles; a bubble is one message on one side of it — `start` for the other
// person's, `end` for your own — with its time (`meta`) beneath.
import type { ComponentChildren, JSX } from 'preact';
import { bubble, thread, type BubbleSide } from '@boogy/web';
import { DeliveryMark, type DeliveryStatus } from './delivery';

export type ThreadProps = {
  /** The thread's accessible name ("Messages with carol"). */
  label: string;
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'label'>;

/** A log: assistive tech announces a bubble added to it. */
export function Thread({ label, children, ...rest }: ThreadProps) {
  return <div {...rest} {...thread()} role="log" aria-label={label}>{children}</div>;
}

export type BubbleProps = {
  side?: BubbleSide;
  /** Beneath the text: its time, say. */
  meta?: ComponentChildren;
  /** Your own message's delivery — sent, delivered or seen — marked after `meta`. */
  status?: DeliveryStatus;
  /** The message's text; its line breaks are kept. */
  children?: ComponentChildren;
} & JSX.HTMLAttributes<HTMLDivElement>;

export function Bubble({ side, meta, status, children, ...rest }: BubbleProps) {
  return (
    <div {...rest} {...bubble({ side })}>
      <div data-slot="body">{children}</div>
      {(meta != null || status) && (
        <div data-slot="meta">
          {meta}
          {status && <DeliveryMark status={status} />}
        </div>
      )}
    </div>
  );
}
