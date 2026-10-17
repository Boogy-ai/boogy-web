// ThreadView in a real browser, over a fake room of 1,000 messages: it opens
// at the newest, loads older pages as the reader nears the top keeping their
// place, keeps only a window of pages in the page however far they read, and
// brings pages back as they return, without a jump or a message twice.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
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
      lib: { entry: fileURLToPath(new URL('./fixtures/thread-view.fixture.tsx', import.meta.url)), formats: ['iife'], name: 'ThreadViewFixtureBundle' },
    },
  });
  const result = Array.isArray(out) ? out[0] : out;
  return (result as { output: { type: string; code?: string }[] }).output.find((o) => o.type === 'chunk')!.code!;
}

type F = { threadFixture: {
  mount(n: number): void; add(body: string, reveal: boolean): void; fetched(): (string | null)[]; typing(on: boolean): void;
  failOlder(on: boolean): void; missMany(n: number): Promise<void>; remove(id: number): void; live(n: number): void;
  addThenGrow(body: string, px: number): Promise<{ turns: number; moved: boolean }>; grow(px: number): void;
} };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const view = () => page.evaluate(() => {
  const el = document.getElementById('TV')!;
  const items = [...el.querySelectorAll('[data-slot="item"]')];
  const keys = items.map((i) => i.getAttribute('data-key'));
  const top = el.getBoundingClientRect().top;
  const firstVisible = items.find((i) => i.getBoundingClientRect().bottom > top);
  return {
    scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
    rendered: items.length, spacers: el.querySelectorAll('[data-slot="page"][data-spacer]').length,
    duplicates: keys.length - new Set(keys).size,
    firstVisible: firstVisible?.getAttribute('data-key') ?? null,
    firstVisibleOffset: firstVisible ? Math.round(firstVisible.getBoundingClientRect().top - top) : null,
    last: keys[keys.length - 1],
  };
});
/** Scroll to the top and let what that loads arrive. */
const toTop = async () => { await page.evaluate(() => { document.getElementById('TV')!.scrollTop = 0; }); await wait(250); };

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  const code = await bundle();
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 900, height: 800 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.evaluate((c) => { document.documentElement.style.fontSize = '16px'; (0, eval)(c); }, code);
}, 60_000);
afterAll(async () => { await browser?.close(); });

describe('ThreadView', () => {
  it('opens at the newest message, one page read', async () => {
    await page.evaluate(() => (window as unknown as F).threadFixture.mount(1000));
    await wait(300);
    const v = await view();
    expect(v.last).toBe('1000');
    expect(v.scrollTop + v.clientHeight).toBeGreaterThanOrEqual(v.scrollHeight - 1);
    expect(await page.evaluate(() => (window as unknown as F).threadFixture.fetched())).toEqual([null]);
  });

  it('near the top it reads the page before, and the reader stays where they were', async () => {
    await toTop();
    const before = await view();
    expect(before.firstVisible).not.toBeNull();
    await wait(200);
    const after = await view();
    expect(await page.evaluate(() => (window as unknown as F).threadFixture.fetched().length)).toBeGreaterThanOrEqual(2);
    // What was at the top is where it was; the older page is above it.
    expect(after.scrollTop).toBeGreaterThan(0);
    expect(Number(after.firstVisible)).toBeLessThanOrEqual(Number(before.firstVisible));
  });

  it('however far back the reader goes, only a window of pages is in the page', async () => {
    for (let i = 0; i < 14; i++) await toTop();
    const v = await view();
    expect(await page.evaluate(() => (window as unknown as F).threadFixture.fetched().length)).toBeGreaterThan(10);
    expect(v.rendered).toBeLessThanOrEqual(6 * 50);
    expect(v.spacers).toBeGreaterThan(3);
    expect(v.duplicates).toBe(0);
  });

  it('returning, pages come back where they were: no jump, no message twice', async () => {
    const fetchedBefore = await page.evaluate(() => (window as unknown as F).threadFixture.fetched().length);
    for (let i = 0; i < 200; i++) {
      const before = await view();
      await page.evaluate(() => { const el = document.getElementById('TV')!; el.scrollTop += el.clientHeight * 0.8; });
      await wait(80);
      const after = await view();
      expect(after.duplicates).toBe(0);
      // Never thrown back: what was below the top of the view is still at or below it.
      expect(Number(after.firstVisible)).toBeGreaterThanOrEqual(Number(before.firstVisible));
      if (after.scrollTop + after.clientHeight >= after.scrollHeight - 1) break;
    }
    const end = await view();
    expect(end.last).toBe('1000');
    expect(end.scrollTop + end.clientHeight).toBeGreaterThanOrEqual(end.scrollHeight - 1);
    expect(end.rendered).toBeLessThanOrEqual(6 * 50);
    // Pages it gave up were read again on the way.
    expect(await page.evaluate(() => (window as unknown as F).threadFixture.fetched().length)).toBeGreaterThan(fetchedBefore);
  });

  it('a new message at the end is followed; reading back, it never moves the reader', async () => {
    await page.evaluate(() => (window as unknown as F).threadFixture.add('live one', false));
    await wait(100);
    let v = await view();
    expect(v.last).toBe('1001');
    expect(v.scrollTop + v.clientHeight).toBeGreaterThanOrEqual(v.scrollHeight - 1);
    await page.evaluate(() => { const el = document.getElementById('TV')!; el.scrollTop -= el.clientHeight * 2; });
    await wait(150);
    const reading = await view();
    await page.evaluate(() => (window as unknown as F).threadFixture.add('live two', false));
    await wait(100);
    v = await view();
    expect(v.firstVisible).toBe(reading.firstVisible);
    expect(v.firstVisibleOffset).toBe(reading.firstVisibleOffset);
    // The reader's own, revealed: back to the end.
    await page.evaluate(() => (window as unknown as F).threadFixture.add('mine', true));
    await wait(100);
    v = await view();
    expect(v.last).toBe('1003');
    expect(v.scrollTop + v.clientHeight).toBeGreaterThanOrEqual(v.scrollHeight - 1);
  });

  it('at the end, what grows there (someone typing) keeps the reader at the end, inside the log', async () => {
    await page.evaluate(() => { const el = document.getElementById('TV')!; el.scrollTop = el.scrollHeight; });
    await wait(100);
    await page.evaluate(() => (window as unknown as F).threadFixture.typing(true));
    await wait(150);
    const v = await view();
    expect(v.scrollTop + v.clientHeight).toBeGreaterThanOrEqual(v.scrollHeight - 1);
    expect(await page.evaluate(() => !!document.querySelector('#TV [role="log"] [data-boogy="bubble"][data-typing="true"]'))).toBe(true);
  });

  it('nudged up a little, what grows at the end does not pull the reader back', async () => {
    await page.evaluate(() => (window as unknown as F).threadFixture.typing(false));
    await page.evaluate(() => { const el = document.getElementById('TV')!; el.scrollTop = el.scrollHeight; });
    await wait(100);
    await page.evaluate(() => { document.getElementById('TV')!.scrollTop -= 40; });
    await wait(100);
    const before = await view();
    await page.evaluate(() => (window as unknown as F).threadFixture.typing(true));
    await wait(150);
    expect((await view()).scrollTop).toBe(before.scrollTop);
    await page.evaluate(() => (window as unknown as F).threadFixture.typing(false));
  });

  it('the message holding the reader\'s place deleted, the one after it stays where it was', async () => {
    await page.evaluate(() => { const el = document.getElementById('TV')!; el.scrollTop = el.scrollHeight - el.clientHeight * 3; });
    await wait(200);
    const before = await page.evaluate(() => {
      const el = document.getElementById('TV')!;
      const top = el.getBoundingClientRect().top;
      const items = [...el.querySelectorAll('[data-slot="item"]')];
      const i = items.findIndex((x) => x.getBoundingClientRect().bottom > top);
      return { first: items[i].getAttribute('data-key')!, next: items[i + 1].getAttribute('data-key')!, nextOffset: Math.round(items[i + 1].getBoundingClientRect().top - top) };
    });
    await page.evaluate((id) => (window as unknown as F).threadFixture.remove(Number(id)), before.first);
    await wait(150);
    const nextOffset = await page.evaluate((key) => {
      const el = document.getElementById('TV')!;
      return Math.round(el.querySelector(`[data-key="${key}"]`)!.getBoundingClientRect().top - el.getBoundingClientRect().top);
    }, before.next);
    expect(nextOffset).toBe(before.nextOffset);
  });

  it('a start-over (more was missed than a page) brings the reader to the newest', async () => {
    await toTop();
    await toTop();
    await page.evaluate(() => (window as unknown as F).threadFixture.missMany(80));
    await wait(300);
    const v = await view();
    expect(v.scrollTop + v.clientHeight).toBeGreaterThanOrEqual(v.scrollHeight - 1);
    expect(v.duplicates).toBe(0);
  });

  it('a newest page grown long by live messages, at the end, is trimmed to a fresh read', async () => {
    const before = await page.evaluate(() => (window as unknown as F).threadFixture.fetched().length);
    await page.evaluate(() => (window as unknown as F).threadFixture.live(260));
    await wait(400);
    const v = await view();
    expect(v.scrollTop + v.clientHeight).toBeGreaterThanOrEqual(v.scrollHeight - 1);
    expect(v.rendered).toBeLessThanOrEqual(6 * 50);
    const after = await page.evaluate(() => (window as unknown as F).threadFixture.fetched());
    expect(after.slice(before)).toContain(null);
  });

  it('an older page that fails is not asked for again and again; the reader can try again', async () => {
    await page.evaluate(() => (window as unknown as F).threadFixture.failOlder(true));
    const before = await page.evaluate(() => (window as unknown as F).threadFixture.fetched().length);
    await toTop();
    await wait(1500);
    const asked = (await page.evaluate(() => (window as unknown as F).threadFixture.fetched().length)) - before;
    expect(asked).toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => document.querySelector('#TV [data-boogy="paged-list-end"] button')?.textContent)).toBe('Try again');
    await page.evaluate(() => (window as unknown as F).threadFixture.failOlder(false));
  });

  it('a message that grows after the view put the reader at the end (its cards, its images) keeps them there', async () => {
    await page.evaluate(() => { const el = document.getElementById('TV')!; el.scrollTop = el.scrollHeight; });
    await wait(150);
    // Its cards arrive before the browser reports the view's own scroll to
    // the end (they were read already): far more than a quarter of a view.
    const grown = await page.evaluate(() => (window as unknown as F).threadFixture.addThenGrow('with cards coming', 2000));
    expect(grown.moved).toBe(true);
    await wait(150);
    // Then its images arrive.
    await page.evaluate(() => (window as unknown as F).threadFixture.grow(2400));
    await wait(150);
    const v = await view();
    expect(v.scrollHeight - v.scrollTop - v.clientHeight).toBeLessThanOrEqual(1);
  });

  it('a reader at the end stays there when the conversation\'s own height shrinks (a composer growing)', async () => {
    await page.evaluate(() => { const el = document.getElementById('TV')!; el.scrollTop = el.scrollHeight; });
    await wait(150);
    await page.evaluate(() => { document.getElementById('TV')!.parentElement!.style.height = '420px'; });
    await wait(150);
    const v = await view();
    await page.evaluate(() => { document.getElementById('TV')!.parentElement!.style.height = '600px'; });
    expect(v.scrollHeight - v.scrollTop - v.clientHeight).toBeLessThanOrEqual(1);
  });
});
