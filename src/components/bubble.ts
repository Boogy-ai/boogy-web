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

export interface ThreadAttrs { 'data-boogy': 'thread' }
export function thread(): ThreadAttrs {
  return { 'data-boogy': 'thread' };
}
