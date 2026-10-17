// Panel in a real layout engine: the head stays while the body scrolls, a
// panel in a cell is the cell's height, and a growing one takes what its
// column leaves.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';
import { COMPONENTS_CSS } from '../src/components/components-css';

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
let browser: Browser;
let page: Page;

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 700 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    document.adoptedStyleSheets = [sheet];
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});
afterAll(async () => { await browser?.close(); });

const rows = (n: number) => `<ul data-boogy="list">${Array.from({ length: n }, (_, i) => `<li><div data-boogy="list-item"><span data-slot="text"><span data-slot="title">row ${i}</span></span></div></li>`).join('')}</ul>`;

describe('a panel', () => {
  it('in a cell of fixed height: as tall as the cell; its head stays while only its body scrolls', async () => {
    await page.evaluate((list) => {
      document.body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 300px;gap:16px;height:400px;padding:16px;box-sizing:border-box">
          <section id="P" data-boogy="panel"><div id="H" data-slot="head">Members</div><div id="B" data-slot="body">${list}</div></section>
          <div></div>
        </div>`;
    }, rows(60));
    const r = await page.evaluate(() => {
      const P = document.getElementById('P')!, H = document.getElementById('H')!, B = document.getElementById('B')!;
      const before = H.getBoundingClientRect().top;
      B.scrollTop = 600;
      return { panelH: P.getBoundingClientRect().height, scrolled: B.scrollTop, headMoved: H.getBoundingClientRect().top - before, pageH: document.documentElement.scrollHeight, bodyTop: B.getBoundingClientRect().top, headBottom: H.getBoundingClientRect().bottom };
    });
    expect(r.panelH).toBeCloseTo(368, 0);
    expect(r.scrolled).toBeGreaterThan(0);
    expect(r.headMoved).toBe(0);
    expect(r.pageH).toBeLessThanOrEqual(700);
    expect(r.bodyTop).toBeGreaterThanOrEqual(r.headBottom);
  });

  it('unconstrained: as tall as its content, with nothing to scroll', async () => {
    await page.evaluate((list) => {
      document.body.innerHTML = `<div style="width:300px"><section id="P" data-boogy="panel"><div data-slot="head">Invite</div><div id="B" data-slot="body">${list}</div></section></div>`;
    }, rows(3));
    const r = await page.$eval('#B', (b) => ({ client: b.clientHeight, scroll: b.scrollHeight }));
    expect(r.scroll).toBe(r.client);
  });

  it('grow, in a column: takes what the panel above it leaves, and scrolls inside that', async () => {
    await page.evaluate((list) => {
      document.body.innerHTML = `
        <div id="COL" style="display:flex;flex-direction:column;gap:16px;height:500px;width:320px">
          <section id="A" data-boogy="panel"><div data-slot="body"><p style="margin:0;height:120px">form</p></div></section>
          <section id="G" data-boogy="panel" data-grow="true"><div data-slot="head">Links</div><div id="B" data-slot="body">${list}</div></section>
        </div>`;
    }, rows(40));
    const r = await page.evaluate(() => {
      const a = document.getElementById('A')!.getBoundingClientRect();
      const g = document.getElementById('G')!.getBoundingClientRect();
      const col = document.getElementById('COL')!.getBoundingClientRect();
      const b = document.getElementById('B')!;
      return { bottom: g.bottom, colBottom: col.bottom, gap: g.top - a.bottom, scrolls: b.scrollHeight > b.clientHeight };
    });
    expect(r.bottom).toBeCloseTo(r.colBottom, 0);
    expect(r.gap).toBeCloseTo(16, 0);
    expect(r.scrolls).toBe(true);
  });

  it('nothing in it scrolls sideways', async () => {
    await page.evaluate(() => {
      document.body.innerHTML = `<div style="width:240px;height:200px;display:flex"><section id="P" data-boogy="panel" data-grow="true"><div id="B" data-slot="body"><p style="margin:0;white-space:nowrap">a line far too long to fit in so narrow a panel as this one</p></div></section></div>`;
    });
    expect(await page.$eval('#B', (b) => b.scrollWidth > b.clientWidth && getComputedStyle(b).overflowX !== 'hidden')).toBe(false);
  });
});
