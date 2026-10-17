// Links in a message's text, and the preview card of a linked page, as other
// messengers show one: the site's name, the page's title, its description and
// its image.
//
// Links are found by linkifyjs (an established finder, never one of ours),
// which the host serves at LINKIFY_PATH, loaded the first time text that could
// hold a link renders; until then the text shows as it is. A bare name
// (example.com) links to https.
//
// A card comes from the platform: GET PREVIEW_PATH?url=<link> answers the
// page's card, or 204 when it has none. The platform fetches the page and
// serves its image itself, so a reader's browser never contacts the linked
// site. A page asks once per link (remembering the last PREVIEWS_REMEMBERED);
// "no preview" is remembered, a refusal to answer now (busy, too many) is
// asked again when the platform says.
import { importVendor, vendorLoader } from './vendor-loader';

/** Where the host serves linkifyjs (its version is in the name). */
export const LINKIFY_PATH = '/boogy/vendor/linkify-4.3.3.js';
/** Where the platform answers a link's card. */
export const PREVIEW_PATH = '/boogy/preview';

/** linkifyjs's `find`, the one call used. */
export interface LinkFinder {
  find(text: string, type: 'url', opts: { defaultProtocol: string }): { href: string; start: number; end: number }[];
}

/** A run of text: words, or a link (`text` as written, `href` where it goes). */
export type LinkSegment = { kind: 'text'; text: string } | { kind: 'link'; text: string; href: string };

/** A linked page's card. `image` is the platform's own path for it. */
export interface LinkCard {
  url: string;
  siteName: string | null;
  title: string | null;
  description: string | null;
  image: string | null;
}

/** A card's image: across it under the text, beside it, or none. */
export type PreviewLayout = 'wide' | 'side' | 'none';

export interface LinkPreviewAttrs {
  'data-boogy': 'link-preview';
  'data-layout': PreviewLayout;
}

export function linkPreview(opts: { layout: PreviewLayout }): LinkPreviewAttrs {
  return { 'data-boogy': 'link-preview', 'data-layout': opts.layout };
}

const WEB = /^https?:\/\//i;

/** `text` as runs of words and web links (http and https only: no email, no
 *  other scheme), in order. */
export function splitLinks(text: string, finder: LinkFinder): LinkSegment[] {
  const out: LinkSegment[] = [];
  let at = 0;
  for (const link of finder.find(text, 'url', { defaultProtocol: 'https' })) {
    if (!WEB.test(link.href) || link.start < at) continue;
    if (link.start > at) out.push({ kind: 'text', text: text.slice(at, link.start) });
    out.push({ kind: 'link', text: text.slice(link.start, link.end), href: link.href });
    at = link.end;
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) });
  return out;
}

/** Whether `text` could hold a link: a scheme, `www.`, or a dot between a
 *  letter or digit and two letters. Errs toward yes; the finder decides. */
export function mayHaveLinks(text: string): boolean {
  return /[a-z][a-z0-9+.-]*:\/\/|www\.|[a-z0-9-]\.[a-z]{2,}/i.test(text);
}

const finder = vendorLoader<LinkFinder>(() => importVendor<LinkFinder>(LINKIFY_PATH));

/** The page's one link finder, loading it if no one has (`custom` for a test). */
export function loadLinkFinder(custom?: () => Promise<LinkFinder>): Promise<LinkFinder> {
  return finder.load(custom);
}

/** The link finder, if the page has loaded it. */
export function loadedLinkFinder(): LinkFinder | null {
  return finder.loaded();
}

/** The first `max` distinct https links of `hrefs` (a fragment names a place
 *  in a page, not another page): the ones a message previews. */
export function previewable(hrefs: readonly string[], max: number): string[] {
  const out: string[] = [];
  for (const href of hrefs) {
    if (out.length >= max) break;
    if (!/^https:\/\//i.test(href)) continue;
    const page = href.split('#')[0];
    if (!out.includes(page)) out.push(page);
  }
  return out;
}

/** A wide, large image spans the card under its text; any other sits beside it. */
export function previewImageLayout(width: number, height: number): PreviewLayout {
  return width >= 400 && width >= height * 1.5 ? 'wide' : 'side';
}

const IMAGE_PREFIX = `${PREVIEW_PATH}/image?`;

/** How many links' answers a page remembers; past it, the oldest is let go. */
export const PREVIEWS_REMEMBERED = 500;

/** The platform would not answer now (busy, too many asked): ask again after
 *  `retryAfterMs` when it said, else after a wait of the asker's own. */
export class PreviewNotNow extends Error {
  constructor(status: number, readonly retryAfterMs: number | null) {
    super(`preview: ${status}`);
    this.name = 'PreviewNotNow';
  }
}

/** `Retry-After`, seconds or a date, as a wait in ms; null when absent. */
function retryAfter(r: Response): number | null {
  const v = r.headers.get('retry-after');
  if (!v) return null;
  const seconds = Number(v);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(v);
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now());
}

const read = new Map<string, Promise<LinkCard | null>>();

/** `url`'s card, or null when it has none. Asked once per page; a refusal to
 *  answer now rejects (a `PreviewNotNow` saying when to ask again, or the
 *  network's error) and is asked again next time. */
export function readPreview(url: string, fetcher: typeof fetch = (...a) => fetch(...a)): Promise<LinkCard | null> {
  let card = read.get(url);
  if (!card) {
    card = ask(url, fetcher);
    read.set(url, card);
    if (read.size > PREVIEWS_REMEMBERED) read.delete(read.keys().next().value as string);
    card.catch(() => { if (read.get(url) === card) read.delete(url); });
  }
  return card;
}

/** `href`, if it is an https URL; null otherwise. */
function httpsHref(href: string): string | null {
  try {
    const u = new URL(href);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

async function ask(url: string, fetcher: typeof fetch): Promise<LinkCard | null> {
  const r = await fetcher(`${PREVIEW_PATH}?url=${encodeURIComponent(url)}`, { credentials: 'same-origin' });
  if (r.status === 204 || r.status === 400 || r.status === 404) return null;
  if (!r.ok) throw new PreviewNotNow(r.status, retryAfter(r));
  const body = (await r.json()) as Partial<Record<keyof LinkCard, unknown>> | null;
  const text = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null);
  // The card is a link: only ever to an https page, whatever the answer says.
  const page = typeof body?.url === 'string' ? httpsHref(body.url) : null;
  if (!body || !page) return null;
  const image = text(body.image);
  return {
    url: page,
    siteName: text(body.siteName),
    title: text(body.title),
    description: text(body.description),
    // Only the platform's own path: never an address a reader's browser
    // would fetch from somewhere else.
    image: image && image.startsWith(IMAGE_PREFIX) ? image : null,
  };
}

