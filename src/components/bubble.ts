// Bubble and Thread: a conversation. A thread is a column of bubbles; a bubble
// is one message on one side of it — `start` for the other person's, `end` for
// your own — with its text (line breaks kept) and, beneath, its time.

export const BUBBLE_SIDES = ['start', 'end'] as const;
export type BubbleSide = (typeof BUBBLE_SIDES)[number];

export interface BubbleAttrs { 'data-boogy': 'bubble'; 'data-side': BubbleSide }
export function bubble(opts: { side?: BubbleSide } = {}): BubbleAttrs {
  const side = opts.side ?? 'start';
  if (!BUBBLE_SIDES.includes(side)) throw new Error(`bubble(): side must be one of ${BUBBLE_SIDES.join(', ')}, got "${side}"`);
  return { 'data-boogy': 'bubble', 'data-side': side };
}

export interface ThreadAttrs {
  'data-boogy': 'thread';
  /** Every bubble in it casts a subtle shadow, lifting it off a busy background. */
  'data-shadow'?: '';
}
export function thread({ shadow = false }: { shadow?: boolean } = {}): ThreadAttrs {
  const attrs: ThreadAttrs = { 'data-boogy': 'thread' };
  if (shadow) attrs['data-shadow'] = '';
  return attrs;
}

/** The scroller around a thread read a page at a time (ThreadView): it scrolls
 *  up and down only, and keeps the reader's place itself. */
export interface ThreadViewAttrs {
  'data-boogy': 'thread-view';
}
export function threadView(): ThreadViewAttrs {
  return { 'data-boogy': 'thread-view' };
}
