// A Sheet's ground in a real layout engine: translucent by default, as the
// page's own ground is, so whatever frames the page shows through it; opaque
// only when the page asks for it with --sheet-ground.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';
import { COMPONENTS_CSS } from '../src/components/components-css';

// A missing browser FAILS the suite: a skipped measurement is not a pass.
const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
let browser: Browser;
let page: Page;

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    document.adoptedStyleSheets = [sheet];
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});

afterAll(async () => {
  await browser?.close();
});

/** The alpha of a Sheet's computed background, in `scheme`, with `style` on it. */
function groundAlpha(scheme: 'light' | 'dark', style: string): Promise<number> {
  return page.evaluate((scheme, style) => {
    document.documentElement.style.colorScheme = scheme;
    document.body.innerHTML = `<div data-boogy="sheet" style="${style}"><div data-slot="body">x</div></div>`;
    const bg = getComputedStyle(document.querySelector('[data-boogy="sheet"]')!).backgroundColor;
    const alpha = bg.match(/\/\s*([\d.]+)\s*\)$/) ?? bg.match(/^rgba\(.*,\s*([\d.]+)\)$/);
    return alpha ? Number(alpha[1]) : 1;
  }, scheme, style);
}

describe('a Sheet ground', () => {
  for (const scheme of ['light', 'dark'] as const) {
    it(`is the page's translucent ground by default (${scheme}): what frames the page shows through`, async () => {
      expect(await groundAlpha(scheme, '')).toBeLessThan(1);
    });
    it(`is opaque when the page sets --sheet-ground to the solid ground (${scheme})`, async () => {
      expect(await groundAlpha(scheme, '--sheet-ground: var(--ground-solid)')).toBe(1);
    });
  }
});
