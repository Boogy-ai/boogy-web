// Link previews in a real browser: a message's links and its cards in a
// narrow bubble. Nothing scrolls sideways; a wide image spans its card under
// the text and a square one sits beside it; a long title stops at two lines.
// The platform's answers come from request interception.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { build } from 'vite';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';
import { COMPONENTS_CSS } from '../src/components/components-css';

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
const ORIGIN = 'http://app.test';
let browser: Browser;
let page: Page;

async function bundle(): Promise<string> {
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    root: fileURLToPath(new URL('..', import.meta.url)),
    resolve: { alias: [{ find: /^@boogy\/web$/, replacement: fileURLToPath(new URL('../src/index.ts', import.meta.url)) }] },
    oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL('./fixtures/link-preview.fixture.tsx', import.meta.url)), formats: ['iife'], name: 'LinkPreviewFixtureBundle' },
    },
  });
  const result = Array.isArray(out) ? out[0] : out;
  return (result as { output: { type: string; code?: string }[] }).output.find((o) => o.type === 'chunk')!.code!;
}

const LONG = 'A headline that goes on and on, far longer than any card has room for, so that it has to stop somewhere sensible';
/** The platform's cards, by link; each image a PNG of the given size (the
 *  platform serves PNG, JPEG, GIF or WebP, never SVG). */
const CARDS: Record<string, { title: string; image?: [number, number] }> = {
  'https://wide.example/': { title: LONG, image: [1200, 630] },
  'https://square.example/': { title: 'Square', image: [400, 400] },
};
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: Buffer) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const pngChunk = (type: string, data: Buffer) => {
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
};
/** A solid teal PNG, `w` by `h`. */
const png = ([w, h]: [number, number]) => {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head[8] = 8; // bit depth
  head[9] = 2; // RGB
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) row.set([0x2a, 0x8a, 0x8a], 1 + x * 3);
  const pixels = deflateSync(Buffer.concat(Array.from({ length: h }, () => row)));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk('IHDR', head), pngChunk('IDAT', pixels), pngChunk('IEND', Buffer.alloc(0))]);
};

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  const code = await bundle();
  browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = new URL(req.url());
    const link = url.searchParams.get('url') ?? '';
    const card = CARDS[link];
    if (url.pathname === '/boogy/preview') {
      if (!card) return void req.respond({ status: 204 });
      return void req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: link, siteName: new URL(link).host, title: card.title, description: 'What it is about, at some length.',
          image: card.image ? `/boogy/preview/image?url=${encodeURIComponent(link)}` : null,
        }),
      });
    }
    if (url.pathname === '/boogy/preview/image' && card?.image) {
      return void req.respond({ status: 200, contentType: 'image/png', body: png(card.image) });
    }
    return void req.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head></head><body style="margin:0"></body></html>' });
  });
  await page.setViewport({ width: 900, height: 900 });
  await page.goto(`${ORIGIN}/`);
  await page.evaluate((css, code) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    document.adoptedStyleSheets = [sheet];
    (0, eval)(code);
  }, FOUNDATION_CSS + COMPONENTS_CSS, code);
  await page.evaluate(() => (window as unknown as { previewFixture: { mount(t: string, w: number): Promise<void> } }).previewFixture.mount(
    'two pages: https://wide.example/ and https://square.example/ and a third https://third.example/ with no card',
    260,
  ));
  await page.waitForFunction(() => document.querySelectorAll('[data-boogy="link-preview"] img').length === 2, { timeout: 10_000 });
}, 60_000);
afterAll(async () => { await browser?.close(); });

describe('link previews in a narrow bubble', () => {
  it('links all three, previews the first two, and nothing scrolls sideways', async () => {
    const r = await page.evaluate(() => {
      const root = document.getElementById('R')!;
      // Content spilling out of a box that does not clip it (an ellipsis clips
      // on purpose), or the page itself scrolling sideways.
      const overflow = [root, ...root.querySelectorAll<HTMLElement>('*')].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible');
      if (document.scrollingElement!.scrollWidth > document.scrollingElement!.clientWidth) overflow.push(document.body);
      const cards = [...root.querySelectorAll<HTMLElement>('[data-boogy="link-preview"]')];
      return {
        links: root.querySelectorAll('a[data-slot="link"]').length,
        cards: cards.map((c) => c.getAttribute('href')),
        widest: Math.max(...cards.map((c) => c.getBoundingClientRect().right)) <= root.getBoundingClientRect().right + 0.5,
        overflow: overflow.map((el) => el.getAttribute('data-boogy') ?? el.getAttribute('data-slot') ?? el.tagName),
      };
    });
    expect(r).toEqual({ links: 3, cards: ['https://wide.example/', 'https://square.example/'], widest: true, overflow: [] });
  });

  it('a wide image spans the card under its text; a square one sits beside it', async () => {
    const r = await page.evaluate(() => {
      const [wide, square] = [...document.querySelectorAll<HTMLElement>('[data-boogy="link-preview"]')];
      const geo = (card: HTMLElement) => {
        const img = card.querySelector('img')!.getBoundingClientRect();
        const body = card.querySelector('[data-slot="body"]')!.getBoundingClientRect();
        return { layout: card.dataset.layout, below: img.top >= body.bottom - 0.5, beside: img.left >= body.right - 0.5, imgW: Math.round(img.width), bodyW: Math.round(body.width) };
      };
      return { wide: geo(wide), square: geo(square) };
    });
    expect(r.wide.layout).toBe('wide');
    expect(r.wide.below).toBe(true);
    expect(r.wide.imgW).toBe(r.wide.bodyW);
    expect(r.square.layout).toBe('side');
    expect(r.square.beside).toBe(true);
  });

  it('a card has no cap of its own: alone it takes the message\'s width', async () => {
    const r = await page.evaluate(async () => {
      const root = document.getElementById('R')!;
      root.style.width = '900px';
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const previews = root.querySelector('[data-boogy="fenced-text"] > [data-slot="previews"]')!.getBoundingClientRect();
      const widest = Math.max(...[...root.querySelectorAll('[data-boogy="link-preview"]')].map((c) => c.getBoundingClientRect().width));
      const token = getComputedStyle(document.documentElement).getPropertyValue('--card-max').trim();
      root.style.width = '260px';
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      return { token, row: Math.round(previews.width), widest: Math.round(widest) };
    });
    expect(r.token).toBe('');
    // Two cards share the row: together they fill it.
    expect(r.widest * 2).toBeGreaterThan(r.row - 40);
  });

  it('a long title stops at two lines', async () => {
    const lines = await page.evaluate(() => {
      const title = document.querySelector<HTMLElement>('[data-boogy="link-preview"] [data-slot="title"]')!;
      return Math.round(title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight));
    });
    expect(lines).toBe(2);
  });
});
