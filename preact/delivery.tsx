// Delivery marks and the typing bubble: the two signals a chat shows around a
// message. A mark is one check for sent, two for delivered, and two in the
// accent colour for seen. The typing bubble is three pulsing dots on the other
// person's side, announced politely.
import { bubble } from '@boogy/web';
import { Glyph } from './glyphs';

export type DeliveryStatus = 'sent' | 'delivered' | 'seen';

const LABEL: Record<DeliveryStatus, string> = { sent: 'Sent', delivered: 'Delivered', seen: 'Seen' };

export function DeliveryMark({ status }: { status: DeliveryStatus }) {
  return (
    <span data-boogy="delivery-mark" data-status={status} role="img" aria-label={LABEL[status]}>
      <Glyph shape={status === 'sent' ? 'check' : 'check-double'} size="sm" />
    </span>
  );
}

/** The other person is typing: `label` names it for assistive tech ("dave is typing"). */
export function TypingBubble({ label }: { label: string }) {
  return (
    <div {...bubble({ side: 'start' })} data-typing="true" role="status" aria-label={label}>
      <div data-slot="body">
        <span data-slot="dot" />
        <span data-slot="dot" />
        <span data-slot="dot" />
      </div>
    </div>
  );
}
