import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';
import { COMPONENTS_CSS } from '../src/components/components-css';

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
let browser: Browser;
let page: Page;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/** The same page on a touch screen (a coarse pointer). */
let touch: Page;

async function prepare(p: Page) {
  await p.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:40px"></body></html>');
  await p.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    const still = new CSSStyleSheet();
    still.replaceSync('*, *::before, *::after { transition: none !important; }');
    document.adoptedStyleSheets = [sheet, still];
    document.documentElement.style.setProperty('--scheme', 'dark');
  }, FOUNDATION_CSS + COMPONENTS_CSS);
}

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await prepare(page);
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

describe('an icon button on a touch screen', () => {
  // Its own page, opened last: a page in the background takes no pointer input.
  beforeAll(async () => {
    touch = await browser.newPage();
    await touch.setViewport({ width: 800, height: 600, hasTouch: true, isMobile: true });
    await prepare(touch);
  });
  afterAll(async () => {
    await touch?.close();
    await page.bringToFront();
  });

  // An icon button holding the SDK's glyph, or an icon drawn at 1em; and the
  // tokens it is sized from, read in the same page.
  const SDK_GLYPH = '<svg id="g" data-boogy="glyph" viewBox="0 0 24 24"></svg>';
  const EM_ICON = '<svg id="g" viewBox="0 0 24 24" style="width:1em;height:1em"></svg>';
  const measure = (on: Page, glyph: string) => on.evaluate((html) => {
    document.body.innerHTML = `${html}<i id="t" style="display:block;width:var(--touch-min);height:var(--icon-md)"></i>`;
    const r = (id: string) => document.getElementById(id)!.getBoundingClientRect();
    return {
      coarse: matchMedia('(pointer: coarse)').matches,
      button: [r('b').width, r('b').height],
      glyph: [r('g').width, r('g').height],
      fontSize: parseFloat(getComputedStyle(document.getElementById('b')!).fontSize),
      touchMin: r('t').width,
      iconMd: r('t').height,
    };
  }, btn('data-variant="quiet" data-shape="icon" data-size="md"', glyph));

  it('its glyph grows with its 44px target to half of it, the SDK\'s glyph and a 1em icon alike', async () => {
    for (const glyph of [SDK_GLYPH, EM_ICON]) {
      const m = await measure(touch, glyph);
      expect(m.coarse).toBe(true);
      expect(m.button[0]).toBeGreaterThanOrEqual(m.touchMin);
      expect(m.button[1]).toBeGreaterThanOrEqual(m.touchMin);
      expect(m.glyph[0]).toBeCloseTo(Math.max(m.touchMin / 2, m.iconMd), 1);
      expect(m.glyph[1]).toBeCloseTo(Math.max(m.touchMin / 2, m.iconMd), 1);
    }
  });

  it('without touch the glyph is as before: the SDK\'s at --icon-md, a 1em icon at the button\'s text size', async () => {
    const sdk = await measure(page, SDK_GLYPH);
    expect(sdk.coarse).toBe(false);
    expect(sdk.button[1]).toBeLessThan(sdk.touchMin);
    expect(sdk.glyph[0]).toBeCloseTo(sdk.iconMd, 1);
    const em = await measure(page, EM_ICON);
    expect(em.glyph[0]).toBeCloseTo(em.fontSize, 1);
    expect(em.glyph[0]).toBeLessThan(em.touchMin / 2);
  });
});
