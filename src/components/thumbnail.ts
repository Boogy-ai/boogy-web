// Thumbnail: a rounded-square image slot. With no image — or one that fails
// to load — it shows the label's initials on a tone chosen from the label, so
// the same label always wears the same colour wherever it appears.
import { labelWords } from './drawer';

export const THUMBNAIL_SIZES = ['sm', 'md', 'lg'] as const;
export type ThumbnailSize = (typeof THUMBNAIL_SIZES)[number];

/** How many placeholder tones the stylesheet defines (`data-tone` 0..7). */
export const THUMBNAIL_TONES = 8;

export interface ThumbnailAttrs {
  'data-boogy': 'thumbnail';
  'data-size': ThumbnailSize;
  'data-tone': string;
  'data-image': 'true' | 'false';
}

/** A stable tone for `label`: FNV-1a over its UTF-16 code units, mod the palette. */
export function toneOf(label: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % THUMBNAIL_TONES;
}

/** The placeholder's letters: the initials of the label's first two words —
 *  one letter for a one-word label ("Wallet" → "W", "Squad Chats" → "SC"). */
export function initialsOf(label: string): string {
  return labelWords(label).slice(0, 2).map((w) => Array.from(w)[0] ?? '').join('').toUpperCase();
}

export function thumbnail(opts: { label: string; size?: ThumbnailSize; image: boolean }): ThumbnailAttrs {
  const size = opts.size ?? 'md';
  if (!THUMBNAIL_SIZES.includes(size)) {
    throw new Error(`thumbnail(): size must be one of ${THUMBNAIL_SIZES.join(', ')}, got "${size}"`);
  }
  return {
    'data-boogy': 'thumbnail',
    'data-size': size,
    'data-tone': String(toneOf(opts.label)),
    'data-image': opts.image ? 'true' : 'false',
  };
}
