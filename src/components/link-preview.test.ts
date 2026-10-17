import { describe, expect, it, vi } from 'vitest';
import {
  linkPreview, loadedLinkFinder, loadLinkFinder, mayHaveLinks, previewable, previewImageLayout, readPreview, splitLinks, PreviewNotNow,
  PREVIEW_PATH, PREVIEWS_REMEMBERED, type LinkFinder,
} from './link-preview';
import { COMPONENTS_CSS } from './components-css';

const vendored = async () => (await import('../../vendor/linkify-4.3.3.js' as string)) as LinkFinder;

describe('splitLinks (linkifyjs)', () => {
  it('cuts text into its words and its links, the punctuation after a link left out', async () => {
    const finder = await vendored();
    expect(splitLinks('see https://example.com/a?b=1, and example.org.', finder)).toEqual([
      { kind: 'text', text: 'see ' },
      { kind: 'link', text: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' },
      { kind: 'text', text: ', and ' },
      { kind: 'link', text: 'example.org', href: 'https://example.org' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('links only web addresses: no email, no script, no other scheme', async () => {
    const finder = await vendored();
    for (const text of ['mail me at a@example.com', 'javascript:alert(1)', 'ftp://example.com/x', 'just words.']) {
      expect(splitLinks(text, finder).filter((s) => s.kind === 'link'), text).toEqual([]);
    }
    expect(splitLinks('http://example.com', finder)).toEqual([{ kind: 'link', text: 'http://example.com', href: 'http://example.com' }]);
  });

  it('text with no link is one run', async () => {
    expect(splitLinks('hello there', await vendored())).toEqual([{ kind: 'text', text: 'hello there' }]);
  });
});

describe('mayHaveLinks', () => {
  it('is cheap and errs toward yes, so the finder loads only for text that could hold a link', () => {
    for (const t of ['https://x.io', 'see example.com', 'www.example.com']) expect(mayHaveLinks(t), t).toBe(true);
    for (const t of ['hi', 'ok. sure', '3.14']) expect(mayHaveLinks(t), t).toBe(false);
  });
});

describe('the finder loads once per page', () => {
  it('is shared, and known once loaded', async () => {
    const load = vi.fn(vendored);
    const [a, b] = await Promise.all([loadLinkFinder(load), loadLinkFinder(load)]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);
    expect(loadedLinkFinder()).toBe(a);
  });
});

describe('previewable', () => {
  it('the first distinct https links, at most as many as asked', () => {
    const hrefs = ['http://plain.example/', 'https://a.example/1', 'https://a.example/1#again', 'https://b.example/', 'https://c.example/'];
    expect(previewable(hrefs, 2)).toEqual(['https://a.example/1', 'https://b.example/']);
    expect(previewable(hrefs, 0)).toEqual([]);
  });
});

describe('readPreview', () => {
  const card = { url: 'https://a.example/', siteName: 'A', title: 'T', description: 'D', image: `${PREVIEW_PATH}/image?url=https%3A%2F%2Fa.example%2F` };
  const answer = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
    vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } }));

  it('a refusal to answer now says when to ask again', async () => {
    const err = await readPreview('https://a.example/later', answer(429, undefined, { 'retry-after': '30' })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PreviewNotNow);
    expect((err as PreviewNotNow).retryAfterMs).toBe(30_000);
    const plain = await readPreview('https://a.example/busy-plain', answer(503)).catch((e: unknown) => e);
    expect((plain as PreviewNotNow).retryAfterMs).toBeNull();
  });

  it('remembers a bounded number of links, the oldest let go first', async () => {
    const fetcher = answer(204);
    for (let i = 0; i <= PREVIEWS_REMEMBERED; i++) await readPreview(`https://many.example/${i}`, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(PREVIEWS_REMEMBERED + 1);
    await readPreview(`https://many.example/${PREVIEWS_REMEMBERED}`, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(PREVIEWS_REMEMBERED + 1);
    await readPreview('https://many.example/0', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(PREVIEWS_REMEMBERED + 2);
  });

  it('asks the platform once per link per page', async () => {
    const fetcher = answer(200, card);
    const link = 'https://a.example/once';
    expect(await readPreview(link, fetcher)).toEqual(card);
    expect(await readPreview(link, fetcher)).toEqual(card);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(`${PREVIEW_PATH}?url=${encodeURIComponent(link)}`);
  });

  it('no preview is remembered; a refusal to answer now is asked again', async () => {
    const none = answer(204);
    expect(await readPreview('https://a.example/none', none)).toBeNull();
    expect(await readPreview('https://a.example/none', none)).toBeNull();
    expect(none).toHaveBeenCalledTimes(1);
    const busy = answer(429);
    await expect(readPreview('https://a.example/busy', busy)).rejects.toThrow();
    await expect(readPreview('https://a.example/busy', busy)).rejects.toThrow();
    expect(busy).toHaveBeenCalledTimes(2);
  });

  it('a card that would link anywhere but an https page is no card', async () => {
    for (const [i, url] of ['javascript:alert(1)', 'data:text/html,hi', 'http://a.example/', 'not a url'].entries()) {
      expect(await readPreview(`https://a.example/scheme-${i}`, answer(200, { ...card, url })), url).toBeNull();
    }
  });

  it('an image anywhere but the platform\'s own path is dropped', async () => {
    const fetcher = answer(200, { ...card, image: 'https://tracker.example/pixel.png' });
    expect((await readPreview('https://a.example/elsewhere', fetcher))?.image).toBeNull();
  });
});

describe('previewImageLayout', () => {
  it('a wide, large image spans the card; any other sits beside it', () => {
    expect(previewImageLayout(1200, 630)).toBe('wide');
    expect(previewImageLayout(400, 400)).toBe('side');
    expect(previewImageLayout(300, 150)).toBe('side');
  });
});

describe('linkPreview attrs and css', () => {
  it('names its layout', () => {
    expect(linkPreview({ layout: 'wide' })).toEqual({ 'data-boogy': 'link-preview', 'data-layout': 'wide' });
  });
  it('has rules for the card and for links in text', () => {
    expect(COMPONENTS_CSS).toContain('[data-boogy="link-preview"]');
    expect(COMPONENTS_CSS).toContain('[data-boogy="fenced-text"] [data-slot="link"]');
  });
});
