// Striped segments (Meter, ColumnChart) as a real engine draws them. A segment
// whose colour is an oklch() token must come out as stripes: many light/dark
// alternations along a row, with both tones well represented. Read from the
// pixels of a screenshot, so a pattern the engine draws as a few stray lines
// on a flat ground fails here, whatever the CSS says.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';
import { COMPONENTS_CSS } from '../src/components/components-css';
import { decodePng } from '../test-support/png';

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
let browser: Browser;
let page: Page;

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 480, height: 200 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0;padding:40px;background:#fff"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    document.adoptedStyleSheets = [sheet];
    document.documentElement.style.fontSize = '16px';
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});

afterAll(async () => {
  await browser?.close();
});

describe('striped segments', () => {
  it('an oklch() colour comes out as stripes: many alternations along a row, both tones present', async () => {
    await page.evaluate(() => {
      document.body.innerHTML =
        '<div data-boogy="meter" style="inline-size:320px;block-size:24px">' +
        '<span data-slot="segment" data-pattern="stripes" style="--segment-color: oklch(66% 0.14 25); width:100%"></span></div>';
    });
    const segment = (await page.$('[data-slot="segment"]'))!;
    const png = decodePng(await segment.screenshot({ type: 'png' }));
    const y = Math.floor(png.height / 2);
    const light = Array.from({ length: png.width }, (_, x) => {
      const [r, g, b] = png.rgb(x, y);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    });
    const lo = Math.min(...light), hi = Math.max(...light);
    const dark = light.map((l) => l < (lo + hi) / 2);
    const alternations = dark.filter((d, i) => i > 0 && d !== dark[i - 1]).length;
    const darkShare = dark.filter(Boolean).length / dark.length;
    // 320px of 45° stripes a few px wide alternate dozens of times; a flat
    // ground crossed by stray lines alternates a handful.
    expect(hi - lo, 'two tones').toBeGreaterThan(20);
    expect(alternations, `alternations along the row (dark share ${darkShare.toFixed(2)})`).toBeGreaterThanOrEqual(30);
    expect(darkShare).toBeGreaterThan(0.25);
    expect(darkShare).toBeLessThan(0.75);
  });
});
