// Notice: the words of every tone (neutral, warning, danger) meet WCAG AA
// (4.5:1) against the grounds a page is drawn on, in both colour schemes. The
// colour is read as the engine computed it, so the check holds in each engine
// and for any token change.
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

/** The ratio of a notice's text to a ground, both as the engine resolved them
 *  to sRGB (a 1px canvas turns any CSS colour into channels). */
async function ratio(tone: string, scheme: 'light' | 'dark', ground: string): Promise<number> {
  return page.evaluate((t, s, g) => {
    document.documentElement.style.setProperty('--scheme', s);
    document.body.innerHTML = `<p id="n" data-boogy="notice" data-tone="${t}">Words</p><div id="g" style="background:var(${g})"></div>`;
    const px = (css: string): [number, number, number] => {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      const x = c.getContext('2d', { willReadFrequently: true })!;
      x.fillStyle = css;
      x.fillRect(0, 0, 1, 1);
      const d = x.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const lum = ([r, gg, b]: [number, number, number]) => {
      const f = (v: number) => { const u = v / 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
    };
    const text = px(getComputedStyle(document.getElementById('n')!).color);
    const bg = px(getComputedStyle(document.getElementById('g')!).backgroundColor);
    const [hi, lo] = [lum(text), lum(bg)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
  }, tone, scheme, ground);
}

describe('Notice contrast', () => {
  for (const tone of ['neutral', 'warning', 'danger']) {
    for (const scheme of ['light', 'dark'] as const) {
      for (const ground of ['--ground-solid', '--ground-sunken']) {
        it(`${tone} text is at least 4.5:1 on ${ground} in ${scheme}`, async () => {
          const r = await ratio(tone, scheme, ground);
          expect(r, `${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});
