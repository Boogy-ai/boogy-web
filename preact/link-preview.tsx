// <LinkPreview> (see `linkPreview()` in the core package): a linked page's
// card, as the platform reads it. Nothing shows until it is in, and nothing at
// all for a page with none; a platform too busy to answer is asked again when
// it says (and never sooner than a wait of our own), a few times. Its image,
// once loaded, goes across the card (a wide one) or beside it.
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { linkPreview, previewImageLayout, PreviewNotNow, readPreview, type LinkCard, type PreviewLayout } from '@boogy/web';

/** Tries in all, and the first wait, before a card settles for none. */
const READ_TRIES = 4;
const READ_RETRY_MS = 5000;

export type LinkPreviewProps = {
  /** The linked page, https. */
  url: string;
} & Omit<JSX.HTMLAttributes<HTMLAnchorElement>, 'children' | 'href'>;

export function LinkPreview({ url, ...rest }: LinkPreviewProps) {
  const card = useCard(url);
  const [image, setImage] = useState<{ src: string; layout: PreviewLayout } | null>(null);
  const src = card?.image ?? null;
  useEffect(() => {
    setImage(null);
    if (!src) return;
    // Its shape decides where it goes, so it is shown once it has loaded; one
    // that fails is left out.
    let live = true;
    const img = new Image();
    img.onload = () => { if (live) setImage({ src, layout: previewImageLayout(img.naturalWidth, img.naturalHeight) }); };
    img.src = src;
    return () => { live = false; img.onload = null; };
  }, [src]);
  if (!card) return null;
  return (
    <a {...rest} {...linkPreview({ layout: image?.layout ?? 'none' })} href={card.url} target="_blank" rel="noopener noreferrer">
      <span data-slot="body">
        {card.siteName && <span data-slot="site">{card.siteName}</span>}
        {card.title && <span data-slot="title">{card.title}</span>}
        {card.description && <span data-slot="description">{card.description}</span>}
      </span>
      {image && <img data-slot="image" src={image.src} alt="" />}
    </a>
  );
}

/** `url`'s card once read; null before, and for a page with none. */
function useCard(url: string): LinkCard | null {
  const [card, setCard] = useState<LinkCard | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setCard(null); setAttempt(0); }, [url]);
  useEffect(() => {
    let live = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    readPreview(url).then(
      (c) => { if (live) setCard(c); },
      (e: unknown) => {
        if (!live || attempt >= READ_TRIES - 1) return;
        // As long as the platform said to wait, and never less than our own wait.
        const wait = Math.max(READ_RETRY_MS * 2 ** attempt, e instanceof PreviewNotNow ? e.retryAfterMs ?? 0 : 0);
        retry = setTimeout(() => setAttempt(attempt + 1), wait);
      },
    );
    return () => { live = false; clearTimeout(retry); };
  }, [url, attempt]);
  return card;
}
