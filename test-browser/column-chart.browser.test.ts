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
  await page.setContent('<!doctype html><html><head></head><body style="margin:0;padding:40px"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [sheet];
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});

afterAll(async () => {
  await browser?.close();
});

async function mount(html: string): Promise<void> {
  await page.evaluate((h) => { document.body.innerHTML = h; }, html);
}

describe('column-chart hidden table', () => {
  it('adds no scroll to the surface around the chart, however many values it holds', async () => {
    // The markup the component renders: the table inside a hidden box. The
    // table is laid out at full size; the clips keep it from growing the
    // scroller. The scroller
    // is positioned, as a sheet or a panel is: that makes it the containing
    // block of the absolutely positioned table.
    const rows = Array.from({ length: 20 }, (_, i) => `<tr><th scope="row">10:${String(i).padStart(2, '0')}</th><td>${i}</td><td>${i * 2}</td></tr>`).join('');
    await mount(`<div id="scroller" style="position:relative; block-size:200px; inline-size:300px; overflow:auto">
      <figure data-boogy="column-chart">
        <div data-slot="columns" aria-hidden="true"><span data-slot="column"><span data-slot="segment" data-pattern="solid" style="--segment-color:red; height:50%"></span></span></div>
        <div data-slot="axis" aria-hidden="true"><span>10:00</span><span>10:19</span></div>
        <div data-visually-hidden=""><table><caption>Values over time</caption>
          <thead><tr><th scope="col">When</th><th scope="col">first kind</th><th scope="col">a second, longer kind</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
      </figure></div>`);
    const box = await page.$eval('#scroller', (el) => ({ sh: el.scrollHeight, ch: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth }));
    expect(box.sh).toBe(box.ch);
    expect(box.sw).toBe(box.cw);
  });
});
