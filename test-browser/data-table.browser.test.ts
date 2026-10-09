import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';
import { COMPONENTS_CSS } from '../src/components/components-css';
import { bundleFixture } from '../test-support/bundle-fixture';
import { decodePng } from '../test-support/png';

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
let browser: Browser;
let page: Page;
/** A page with the DataTable as an app ships it, bundled with Preact. */
let app: Page;

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  const code = await bundleFixture('../test-browser/fixtures/data-table.fixture.tsx', 'DataTableFixtureBundle');
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setContent('<!doctype html><html><head></head><body style="margin:0;padding:40px"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [sheet];
  }, FOUNDATION_CSS + COMPONENTS_CSS);
  app = await browser.newPage();
  await app.setViewport({ width: 800, height: 400 });
  await app.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await app.evaluate((c) => { document.documentElement.style.fontSize = '16px'; (0, eval)(c); }, code);
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

async function mount(html: string): Promise<void> {
  await page.evaluate((h) => { document.body.innerHTML = h; }, html);
  await page.mouse.move(0, 0);
}

describe('data-table row cover', () => {
  it('a press anywhere on a row lands on its title button, and the header stays put when the body scrolls', async () => {
    await mount(`<div data-boogy="data-table" style="block-size:120px"><table>
      <thead><tr><th scope="col">Question</th><th scope="col">N</th></tr></thead>
      <tbody>${Array.from({ length: 10 }, (_, i) => `<tr><th scope="row" data-slot="title"><button id="b${i}">Q${i}</button></th><td data-numeric="true" id="n${i}">${i}</td></tr>`).join('')}</tbody>
    </table></div>`);
    const box = await page.$eval('#n0', (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const hit = await page.evaluate(({ x, y }) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('button')?.id ?? null, box);
    expect(hit).toBe('b0');
    const headTop = await page.$eval('thead th', (el) => el.getBoundingClientRect().top);
    await page.$eval('[data-boogy="data-table"]', (el) => { el.scrollTop = 80; });
    expect(await page.$eval('thead th', (el) => el.getBoundingClientRect().top)).toBe(headTop);
  });
});

// A sheet fills the window over the page: nothing in the page paints through
// it, not even the parts the SDK itself stacks (a table's sticky header, a
// card's covering title).
describe('a sheet over a page', () => {
  it("covers a data table's sticky header: a point on the header lands in the sheet", async () => {
    await mount(`<div data-boogy="data-table" style="block-size:120px"><table>
      <thead><tr><th scope="col" id="head">Question</th></tr></thead>
      <tbody><tr><th scope="row" data-slot="title"><button>Q</button></th></tr></tbody>
    </table></div>
    <div data-boogy="sheet" id="sheet"><div data-slot="body">Over the page</div></div>`);
    const box = await page.$eval('#head', (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const inSheet = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('#sheet'), box);
    expect(inSheet).toBe(true);
  });
});

type Sort = { key: string; direction: 'ascending' | 'descending' };
type Fixture = { mount(width: number, sort?: Sort, css?: string): void; report(): { shown: string[]; sideways: boolean } };
const frames = () => app.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
async function mountApp(width: number, sort?: Sort, css = ''): Promise<void> {
  await app.evaluate((w, s, c) => (window as unknown as { dataTableFixture: Fixture }).dataTableFixture.mount(w, s ?? undefined, c), width, sort ?? null, css);
  await app.mouse.move(799, 399);
  await frames();
}

/** The pixels of `rect` on the app page, from a screenshot of the page. */
async function pixels(rect: { x: number; y: number; w: number; h: number }) {
  const clip = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.w), height: Math.round(rect.h) };
  const png = decodePng(await app.screenshot({ type: 'png', clip }));
  const light = (x: number, y: number) => { const [r, g, b] = png.rgb(x, y); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  return { width: png.width, height: png.height, light };
}
const rectOf = (selector: string) => app.$eval(selector, (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });

describe('the sort arrow, as drawn', () => {
  /** The ink of the sort glyph in column `n` (1-based): how many pixels are
   *  darker than its ground, and their mean height in the glyph's box (0 top, 1 bottom). */
  async function arrow(n: number) {
    const p = await pixels(await rectOf(`thead th:nth-child(${n}) [data-slot="sort"]`));
    let ground = 0;
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) ground = Math.max(ground, p.light(x, y));
    let ink = 0, sumY = 0;
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) if (p.light(x, y) < ground - 40) { ink += 1; sumY += y; }
    return { ink, at: ink ? sumY / ink / (p.height - 1) : 0.5 };
  }

  it('the sorted column draws an arrow pointing down when descending and up when ascending; an unsorted one draws none', async () => {
    await mountApp(600, { key: 'a', direction: 'descending' });
    const down = await arrow(2);
    const unsorted = await arrow(3);
    await mountApp(600, { key: 'a', direction: 'ascending' });
    const up = await arrow(2);
    // The arrow's head is its widest part: more of its ink sits at that end.
    expect(down.ink).toBeGreaterThan(10);
    expect(down.at).toBeGreaterThan(0.55);
    expect(up.ink).toBeGreaterThan(10);
    expect(up.at).toBeLessThan(0.45);
    expect(unsorted.ink).toBe(0);
  });
});

describe('the focus ring on a row, as drawn', () => {
  // The table scrolls, so it clips what is drawn outside it; a row spans its
  // whole width, so a ring outside the row would lose its two ends.
  it('a keyboard focus on a row title rings the whole row inside its box, every side drawn', async () => {
    await mountApp(600);
    const row = await rectOf('tbody tr:nth-child(2)');
    const before = await pixels(row);
    // Into the row's title from the keyboard, past the two sort buttons and the first row.
    for (let i = 0; i < 4; i++) await app.keyboard.press('Tab');
    expect(await app.evaluate(() => document.activeElement?.textContent)).toBe('Row 1');
    const after = await pixels(row);
    /** The share of a side's pixels, one pixel in from the edge, that the focus changed. */
    const changed = (points: [number, number][]) =>
      points.filter(([x, y]) => Math.abs(after.light(x, y) - before.light(x, y)) > 30).length / points.length;
    const w = after.width, h = after.height;
    const across = (y: number) => Array.from({ length: w - 8 }, (_, i): [number, number] => [i + 4, y]);
    const down = (x: number) => Array.from({ length: h - 8 }, (_, i): [number, number] => [x, i + 4]);
    expect({
      start: changed(down(1)),
      end: changed(down(w - 2)),
      top: changed(across(1)),
      bottom: changed(across(h - 2)),
    }).toEqual({ start: 1, end: 1, top: 1, bottom: 1 });
  });
});

describe('dropping columns to fit', () => {
  it("keeps a column only with room for its body cells' padding as well as its header's", async () => {
    // The app pads body cells wider than header cells. Fitted on the header
    // cells' padding, the three columns seem to fit 340 px, and the table
    // then needs more.
    await mountApp(340, undefined, '[data-boogy="data-table"] td { padding-inline: 2rem; }');
    const r = await app.evaluate(() => (window as unknown as { dataTableFixture: Fixture }).dataTableFixture.report());
    expect(r).toEqual({ shown: ['Title', 'A'], sideways: false });
  });
});
