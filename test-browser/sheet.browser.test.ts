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

// A long body scrolls; it never squeezes the head or the foot. They were
// shrinkable flex items, so a body far taller than the sheet took their padding
// away: a chat's avatar sat flush against its head's edges, a short chat's not.
// (Under a border-box reset; without one, the padding was safe by accident.)
describe('a Sheet with a body far taller than itself', () => {
  it('keeps its head and foot at their own height; only the body gives way, and scrolls', async () => {
    const heights = (rows: number) => page.evaluate((rows) => {
      // With the border-box reset most apps carry (Squad's does): the head's
      // minimum height then includes its padding, which a squeeze took first.
      document.body.innerHTML = `<style>*, *::before, *::after { box-sizing: border-box; }</style>
        <div style="position:relative;height:300px"><div data-boogy="sheet" style="position:absolute">
        <header data-slot="head" data-head="own"><div style="height:30px">bar</div></header>
        <div data-slot="body">${'<p style="height:40px;margin:0">row</p>'.repeat(rows)}</div>
        <footer data-slot="foot"><div style="height:30px">foot</div></footer></div></div>`;
      const s = document.querySelector('[data-boogy="sheet"]')!;
      const h = (sel: string) => Math.round(s.querySelector(sel)!.getBoundingClientRect().height);
      return { head: h(':scope > [data-slot="head"]'), foot: h(':scope > [data-slot="foot"]'), scrolls: s.querySelector<HTMLElement>(':scope > [data-slot="body"]')!.scrollHeight > 300 };
    }, rows);
    const short = await heights(1);
    const long = await heights(200);
    expect(long.scrolls).toBe(true);
    expect(long.head).toBe(short.head);
    expect(long.foot).toBe(short.foot);
  });
});
