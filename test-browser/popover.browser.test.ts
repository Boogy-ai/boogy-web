// A popover in a real layout engine, inside a parent that sizes its children.
// The top layer takes a popover out of its parent's layout, but the parent's
// rule for its children still matches it; this is where that is caught.
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
  await page.setViewport({ width: 1240, height: 766 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    const still = new CSSStyleSheet();
    still.replaceSync('*, *::before, *::after { transition: none !important; }');
    // A size given to a popover in the SDK's own layer, as a component that
    // composes one sizes it: one class over the popover's own mark.
    const sized = new CSSStyleSheet();
    sized.replaceSync('@layer boogy.components { [data-boogy="popover"].sized { inline-size: 320px; } }');
    document.adoptedStyleSheets = [sheet, still, sized];
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});

afterAll(async () => {
  await browser?.close();
});

/** A popover in `mode`, shown as a child of a two-cell FillGrid (in its
 *  fallback column when `fallback`), placed as the component places one.
 *  Reports its box, its content's, and the viewport's. */
function shownInGrid(mode: 'anchored' | 'page', fallback: boolean, cls = '') {
  return page.evaluate((mode, fallback, cls) => {
    document.body.innerHTML = `
      <div data-boogy="fill-grid" data-fallback="${fallback}" style="width:1000px;height:600px;--cols:2;--rows:1;--fill-min-block:2.75rem">
        <div>one</div><div>two</div>
        <div id="P" class="${cls}" data-boogy="popover" data-mode="${mode}" popover="manual" role="dialog">
          <div id="B" data-slot="body"><p style="margin:0">One line of text</p></div>
        </div>
      </div>`;
    const p = document.getElementById('P') as HTMLElement & { showPopover(): void };
    p.showPopover();
    if (mode === 'anchored') {
      p.style.left = '40px';
      p.style.top = '40px';
      p.style.maxHeight = '700px';
    }
    const box = p.getBoundingClientRect();
    const body = document.getElementById('B')!.getBoundingClientRect();
    return { w: box.width, h: box.height, bodyW: body.width, bodyH: body.height, vw: innerWidth, vh: innerHeight };
  }, mode, fallback, cls);
}

describe('a popover shown inside a FillGrid', () => {
  for (const fallback of [false, true]) {
    const where = fallback ? "the grid's fallback column" : 'a grid of cells';
    it(`anchored, in ${where}: its box is its content's, not a cell's`, async () => {
      const r = await shownInGrid('anchored', fallback);
      // The content plus the two 1px edges.
      expect(r.h).toBeCloseTo(r.bodyH + 2, 0);
      expect(r.w).toBeCloseTo(r.bodyW + 2, 0);
      expect(r.h).toBeLessThan(r.vh / 4);
    });

    it(`anchored, in ${where}: a size given to it in the components layer is its size, not outranked by the SDK's own`, async () => {
      const r = await shownInGrid('anchored', fallback, 'sized');
      expect(r.w).toBeCloseTo(320, 0);
    });

    it(`as a page, in ${where}: it covers the whole screen`, async () => {
      const r = await shownInGrid('page', fallback);
      expect(r.w).toBeCloseTo(r.vw, 0);
      expect(r.h).toBeCloseTo(r.vh, 0);
    });
  }
});
