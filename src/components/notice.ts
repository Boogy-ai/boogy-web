// Notice: one line explaining the state of what is around it — that a list
// could not be loaded, or shows only part of what exists. `danger` says
// something went wrong.
export const NOTICE_TONES = ['neutral', 'warning', 'danger'] as const;
export type NoticeTone = (typeof NOTICE_TONES)[number];
export interface NoticeAttrs { 'data-boogy': 'notice'; 'data-tone': NoticeTone }
export function notice(opts: { tone?: NoticeTone } = {}): NoticeAttrs {
  const tone = opts.tone ?? 'neutral';
  if (!NOTICE_TONES.includes(tone)) throw new Error(`notice(): tone must be one of ${NOTICE_TONES.join(', ')}, got "${tone}"`);
  return { 'data-boogy': 'notice', 'data-tone': tone };
}
