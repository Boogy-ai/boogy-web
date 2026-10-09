// A multi-line field in a real layout: however short its text, it shows at
// least its rows, at either size (a content-sized field would shrink to one
// line, and the large size's taller control must not undo the rows).
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
  await page.setViewport({ width: 1200, height: 800 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0;padding:40px"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    document.adoptedStyleSheets = [sheet];
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});

afterAll(async () => {
  await browser?.close();
});

/** A TextArea's markup with `rows`, at `size`: its height, and its line height. */
function areaIn(size: 'md' | 'lg', rows: number) {
  return page.evaluate((size, rows) => {
    document.body.innerHTML = `<div data-boogy="field" ${size === 'lg' ? 'data-size="lg"' : ''} style="width:400px">
      <label data-slot="label" for="a">Names</label>
      <textarea id="a" data-slot="control" rows="${rows}" style="--field-rows:${rows}"></textarea>
    </div>`;
    const area = document.getElementById('a') as HTMLTextAreaElement;
    const lh = Number.parseFloat(getComputedStyle(area).lineHeight) || Number.parseFloat(getComputedStyle(area).fontSize) * 1.2;
    return { height: area.getBoundingClientRect().height, lh };
  }, size, rows);
}

describe('a multi-line field in a real layout', () => {
  for (const size of ['md', 'lg'] as const) {
    it(`${size}: empty, it still shows its 4 rows`, async () => {
      const r = await areaIn(size, 4);
      expect(r.height).toBeGreaterThanOrEqual(r.lh * 4);
    });
  }
});
