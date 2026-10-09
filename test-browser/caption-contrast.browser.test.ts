// The caption colour (--text-3) meets WCAG AA (4.5:1) for small text against
// every ground token, in both colour schemes, and stays lighter than the
// secondary text colour. Colours are read as the engine computed them, so the
// check holds in each engine and for any token change. A translucent ground is
// composited over the backdrop its scheme shows through it (white in light,
// black in dark).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';

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
  }, FOUNDATION_CSS);
});

afterAll(async () => {
  await browser?.close();
});

const GROUNDS = ['--ground', '--ground-raised', '--ground-sunken', '--ground-solid', '--ground-overlay', '--ground-well'];

/** The ratio of a text token to a ground over its scheme's backdrop, and the
 *  relative luminance of the text token. */
async function measure(textToken: string, scheme: 'light' | 'dark', ground: string): Promise<{ ratio: number; lum: number }> {
  return page.evaluate((tt, s, g) => {
    document.documentElement.style.setProperty('--scheme', s);
    document.body.innerHTML = `<p id="t" style="color:var(${tt})">Words</p><div id="g" style="background:var(${g})"></div>`;
    const px = (css: string, backdrop: string): [number, number, number] => {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      const x = c.getContext('2d', { willReadFrequently: true })!;
      x.fillStyle = backdrop;
      x.fillRect(0, 0, 1, 1);
      x.fillStyle = css;
      x.fillRect(0, 0, 1, 1);
      const d = x.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const lum = ([r, gg, b]: [number, number, number]) => {
      const f = (v: number) => { const u = v / 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
    };
    const textCss = getComputedStyle(document.getElementById('t')!).color;
    const bgCss = getComputedStyle(document.getElementById('g')!).backgroundColor;
    const text = lum(px(textCss, 'white'));
    let worst = Infinity;
    for (const backdrop of s === 'light' ? ['white'] : ['black']) {
      const [hi, lo] = [text, lum(px(bgCss, backdrop))].sort((a, b) => b - a);
      worst = Math.min(worst, (hi + 0.05) / (lo + 0.05));
    }
    return { ratio: worst, lum: text };
  }, textToken, scheme, ground);
}

describe('Caption colour contrast', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const ground of GROUNDS) {
      it(`--text-3 is at least 4.5:1 on ${ground} in ${scheme}`, async () => {
        const { ratio } = await measure('--text-3', scheme, ground);
        expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      });
    }
    it(`--text-3 stays visibly apart from --text-2 in ${scheme}`, async () => {
      const t2 = await measure('--text-2', scheme, '--ground-solid');
      const t3 = await measure('--text-3', scheme, '--ground-solid');
      // In light, lighter text has the higher luminance; in dark, the lower one.
      const lighter = scheme === 'light' ? t3.lum - t2.lum : t2.lum - t3.lum;
      expect(lighter).toBeGreaterThan(0.02);
    });
  }
});
