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
    sheet.replaceSync(css);
    // These tests read each state's END colour; the hover transition would
    // otherwise be caught mid-way.
    const still = new CSSStyleSheet();
    still.replaceSync('*, *::before, *::after { transition: none !important; }');
    document.adoptedStyleSheets = [sheet, still];
    document.documentElement.style.setProperty('--scheme', 'dark');
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});

afterAll(async () => {
  await browser?.close();
});

async function mount(html: string): Promise<void> {
  await page.evaluate((h) => { document.body.innerHTML = h; }, html);
  await page.mouse.move(0, 0);
}
const style = (sel: string, prop: string) =>
  page.$eval(sel, (el, p) => getComputedStyle(el).getPropertyValue(p as string), prop);

describe('pill layout', () => {
  it('is an inline flex box centring its content both ways', async () => {
    await mount('<button id="p" data-boogy="pill" data-variant="solid">x</button>');
    expect(await style('#p', 'display')).toBe('inline-flex');
    expect(await style('#p', 'align-items')).toBe('center');
    expect(await style('#p', 'justify-content')).toBe('center');
  });

  it('keeps the same box in both variants, so switching never moves content', async () => {
    await mount('<button id="a" data-boogy="pill" data-variant="solid">Title</button><button id="b" data-boogy="pill" data-variant="transparent">Title</button>');
    const box = (id: string) => page.$eval(id, (el) => { const r = el.getBoundingClientRect(); return [r.width, r.height]; });
    const [a, b] = [await box('#a'), await box('#b')];
    // Sub-pixel position rounding differs by engine; a moved box would differ by far more.
    expect(b[0]).toBeCloseTo(a[0], 2);
    expect(b[1]).toBeCloseTo(a[1], 2);
  });
});

describe('solid', () => {
  it('shows a ground at rest, a stronger one on hover, and another when pressed down', async () => {
    await mount('<button id="p" data-boogy="pill" data-variant="solid">Title</button>');
    const rest = await style('#p', 'background-color');
    await page.hover('#p');
    const hover = await style('#p', 'background-color');
    await page.mouse.down();
    const active = await style('#p', 'background-color');
    await page.mouse.up();
    expect(rest).not.toBe(TRANSPARENT);
    expect(hover).not.toBe(rest);
    expect(active).not.toBe(hover);
  });

  it('shows a focus ring for keyboard focus', async () => {
    await mount('<button id="p" data-boogy="pill" data-variant="solid">Title</button>');
    await page.keyboard.press('Tab');
    expect(await style('#p', 'outline-style')).toBe('solid');
  });

  it('marks a pressed toggle with the accent', async () => {
    await mount('<button id="a" data-boogy="pill" data-variant="solid">A</button><button id="b" data-boogy="pill" data-variant="solid" aria-pressed="true">B</button>');
    expect(await style('#b', 'background-color')).not.toBe(await style('#a', 'background-color'));
  });

  it('does not react to hover when disabled', async () => {
    await mount('<button id="p" data-boogy="pill" data-variant="solid" disabled>Title</button>');
    const rest = await style('#p', 'background-color');
    await page.hover('#p');
    expect(await style('#p', 'background-color')).toBe(rest);
  });
});

describe('transparent', () => {
  it('shows no shape at rest or on hover', async () => {
    await mount('<button id="p" data-boogy="pill" data-variant="transparent">Title</button>');
    expect(await style('#p', 'background-color')).toBe(TRANSPARENT);
    await page.hover('#p');
    expect(await style('#p', 'background-color')).toBe(TRANSPARENT);
  });

  it('still shows a focus ring for keyboard focus', async () => {
    await mount('<button id="p" data-boogy="pill" data-variant="transparent">Title</button>');
    await page.keyboard.press('Tab');
    expect(await style('#p', 'outline-style')).toBe('solid');
  });
});

describe('ghost', () => {
  it('shows no shape at rest, and the solid shape on its own hover', async () => {
    await mount('<button id="g" data-boogy="pill" data-variant="ghost">Title</button><button id="s" data-boogy="pill" data-variant="solid">Title</button>');
    expect(await style('#g', 'background-color')).toBe(TRANSPARENT);
    await page.hover('#g');
    const ghostHover = await style('#g', 'background-color');
    await page.mouse.move(0, 0);
    const solidRest = await style('#s', 'background-color');
    expect(ghostHover).not.toBe(TRANSPARENT);
    expect(ghostHover).toBe(solidRest);
  });

  it('shows its shape and a ring on keyboard focus, so a keyboard user sees what a pointer user sees', async () => {
    await mount('<button id="g" data-boogy="pill" data-variant="ghost">Title</button>');
    await page.keyboard.press('Tab');
    expect(await style('#g', 'background-color')).not.toBe(TRANSPARENT);
    expect(await style('#g', 'outline-style')).toBe('solid');
  });

  it('keeps the same box as the other variants', async () => {
    await mount('<button id="a" data-boogy="pill" data-variant="solid">Title</button><button id="b" data-boogy="pill" data-variant="ghost">Title</button>');
    const box = (id: string) => page.$eval(id, (el) => { const r = el.getBoundingClientRect(); return [r.width, r.height]; });
    const [a, b] = [await box('#a'), await box('#b')];
    expect(b[0]).toBeCloseTo(a[0], 2);
    expect(b[1]).toBeCloseTo(a[1], 2);
  });
});
