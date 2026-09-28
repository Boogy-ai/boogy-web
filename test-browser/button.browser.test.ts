import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';
import { COMPONENTS_CSS } from '../src/components/components-css';

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
let browser: Browser;
let page: Page;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setContent('<!doctype html><html><head></head><body style="margin:0;padding:40px"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    const still = new CSSStyleSheet();
    still.replaceSync('*, *::before, *::after { transition: none !important; }');
    document.adoptedStyleSheets = [sheet, still];
    document.documentElement.style.setProperty('--scheme', 'dark');
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});
afterAll(async () => { await browser?.close(); });

async function mount(html: string) {
  await page.evaluate((h) => { document.body.innerHTML = h; }, html);
  await page.mouse.move(0, 0);
}
const style = (sel: string, p: string) => page.$eval(sel, (el, p) => getComputedStyle(el).getPropertyValue(p as string), p);
const size = (sel: string) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
const btn = (attrs: string, body = 'Go') => `<button id="b" data-boogy="button" ${attrs}>${body}</button>`;

describe('layout', () => {
  it('is an inline flex box centring its content', async () => {
    await mount(btn('data-variant="quiet" data-shape="text" data-size="md"'));
    expect(await style('#b', 'display')).toBe('inline-flex');
    expect(await style('#b', 'align-items')).toBe('center');
    expect(await style('#b', 'justify-content')).toBe('center');
  });

  it('sizes from --u: md is 2 units tall, sm 1.5; an icon button is square', async () => {
    await mount(btn('data-variant="quiet" data-shape="text" data-size="md"'));
    expect((await size('#b'))[1]).toBe(32);
    await mount(btn('data-variant="quiet" data-shape="icon" data-size="sm"', '<i style="display:block;width:8px;height:8px"></i>'));
    expect(await size('#b')).toEqual([24, 24]);
  });

  it('has standard corners, or is fully rounded when rounded, whatever the variant', async () => {
    for (const v of ['solid', 'quiet', 'danger']) {
      await mount(btn(`data-variant="${v}" data-shape="text" data-size="md"`));
      const standard = parseFloat(await style('#b', 'border-top-left-radius'));
      await mount(btn(`data-variant="${v}" data-shape="text" data-size="md" data-rounded="true"`));
      const round = parseFloat(await style('#b', 'border-top-left-radius'));
      expect(standard).toBeLessThan(16);
      expect(round).toBeGreaterThanOrEqual(16); // at least half the 32px height: a full pill
    }
  });
});

describe('variants', () => {
  it('solid: an accent ground that changes on hover', async () => {
    await mount(btn('data-variant="solid" data-shape="text" data-size="md"'));
    const rest = await style('#b', 'background-color');
    await page.hover('#b');
    expect(rest).not.toBe(TRANSPARENT);
    expect(await style('#b', 'background-color')).not.toBe(rest);
  });

  it('quiet: no ground at rest, a fill on hover', async () => {
    await mount(btn('data-variant="quiet" data-shape="text" data-size="md"'));
    expect(await style('#b', 'background-color')).toBe(TRANSPARENT);
    await page.hover('#b');
    expect(await style('#b', 'background-color')).not.toBe(TRANSPARENT);
  });

  it('danger: coloured text, and a tinted fill on hover', async () => {
    await mount(btn('data-variant="danger" data-shape="text" data-size="md"') + btn('data-variant="quiet" data-shape="text" data-size="md"').replace('id="b"', 'id="q"'));
    expect(await style('#b', 'color')).not.toBe(await style('#q', 'color'));
    await page.hover('#b');
    expect(await style('#b', 'background-color')).not.toBe(TRANSPARENT);
  });

  it('every variant shows a keyboard focus ring and ignores hover when disabled', async () => {
    for (const v of ['solid', 'quiet', 'danger']) {
      await mount(btn(`data-variant="${v}" data-shape="text" data-size="md"`));
      await page.keyboard.press('Tab');
      expect(await style('#b', 'outline-style')).toBe('solid');
      await mount(btn(`data-variant="${v}" data-shape="text" data-size="md" disabled`));
      const rest = await style('#b', 'background-color');
      await page.hover('#b');
      expect(await style('#b', 'background-color')).toBe(rest);
    }
  });

  it('quiet shows a pressed toggle', async () => {
    await mount(btn('data-variant="quiet" data-shape="text" data-size="md" aria-pressed="true"'));
    expect(await style('#b', 'background-color')).not.toBe(TRANSPARENT);
  });
});
