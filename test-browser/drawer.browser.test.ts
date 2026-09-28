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
  await page.setViewport({ width: 1400, height: 900 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    const still = new CSSStyleSheet();
    still.replaceSync('*, *::before, *::after { transition: none !important; }');
    document.adoptedStyleSheets = [sheet, still];
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});

afterAll(async () => {
  await browser?.close();
});

/** A layout of `width` px with the drawer's state as attributes. --u is 16px. */
async function layout(width: number, attrs: Record<string, string>): Promise<void> {
  await page.evaluate(({ width, attrs }) => {
    const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    document.body.innerHTML = `
      <div id="L" data-boogy="drawer-layout" data-collapse-at="md" ${a} style="width:${width}px;height:600px">
        <nav id="D" data-boogy="drawer">
          <a id="T" data-boogy="drawer-item" data-variant="title" href="#"><span id="tmark" data-slot="mark">B</span><span id="tlbl" data-slot="label">Boards</span></a>
          <a id="I" data-boogy="drawer-item" data-variant="entry" href="#"><span id="imark" data-slot="mark">SC</span><span id="lbl" data-slot="label">Scratchpad</span></a>
        </nav>
        <div id="B" data-boogy="drawer-backdrop"></div>
        <main id="M" data-boogy="drawer-main">main</main>
      </div>`;
  }, { width, attrs });
}
const rect = (id: string) => page.$eval(id, (el) => { const r = el.getBoundingClientRect(); return { x: r.x, w: r.width, h: r.height }; });
const css = (id: string, p: string) => page.$eval(id, (el, p) => getComputedStyle(el).getPropertyValue(p as string).trim(), p);

describe('docked (container at or above the breakpoint, md = 48rem)', () => {
  it('reports its mode to script', async () => {
    await layout(1000, { 'data-expanded': 'true' });
    expect(await css('#D', '--boogy-drawer-mode')).toBe('docked');
  });

  it('expanded: a 15-unit column beside the main area', async () => {
    await layout(1000, { 'data-expanded': 'true' });
    expect((await rect('#D')).w).toBeCloseTo(240, 0);
    expect((await rect('#M')).x).toBeCloseTo(240, 0);
    expect((await rect('#lbl')).w).toBeGreaterThan(0);
  });

  it('collapsed: an icon strip, the label kept for screen readers but not shown', async () => {
    await layout(1000, { 'data-expanded': 'false' });
    expect((await rect('#D')).w).toBeCloseTo(52, 0); // 3.25 units
    expect((await rect('#M')).x).toBeCloseTo(52, 0);
    expect((await rect('#lbl')).w).toBeLessThanOrEqual(1);
    expect(await page.$eval('#lbl', (el) => el.textContent)).toBe('Scratchpad');
  });

  it('never shows the backdrop, even if marked open', async () => {
    await layout(1000, { 'data-expanded': 'true', 'data-open': 'true' });
    expect(await css('#B', 'display')).toBe('none');
  });

  it('mirrors for side="end"', async () => {
    await layout(1000, { 'data-expanded': 'true', 'data-side': 'end' });
    expect((await rect('#D')).x).toBeCloseTo(760, 0);
    expect((await rect('#M')).x).toBeCloseTo(0, 0);
  });
});

describe('overlay (container below the breakpoint)', () => {
  it('reports its mode to script', async () => {
    await layout(600, {});
    expect(await css('#D', '--boogy-drawer-mode')).toBe('overlay');
  });

  it('closed: off-canvas and not focusable, the main area takes the full width', async () => {
    await layout(600, { 'data-open': 'false' });
    expect((await rect('#D')).x + (await rect('#D')).w).toBeLessThanOrEqual(0);
    expect(await css('#D', 'visibility')).toBe('hidden');
    expect((await rect('#M')).w).toBeCloseTo(600, 0);
  });

  it('open: over the content, with a backdrop, labels shown whatever `expanded` says', async () => {
    await layout(600, { 'data-open': 'true', 'data-expanded': 'false' });
    expect((await rect('#D')).x).toBeCloseTo(0, 0);
    expect(await css('#D', 'visibility')).toBe('visible');
    expect((await rect('#M')).w).toBeCloseTo(600, 0);
    expect(await css('#B', 'pointer-events')).toBe('auto');
    expect((await rect('#lbl')).w).toBeGreaterThan(1);
  });

  it('follows the breakpoint variant: lg keeps overlay at 1000px', async () => {
    await layout(1000, { 'data-expanded': 'true' });
    await page.$eval('#L', (el) => el.setAttribute('data-collapse-at', 'lg'));
    expect(await css('#D', '--boogy-drawer-mode')).toBe('overlay');
  });
});

describe('the title entry', () => {
  it('is larger than an ordinary entry, label and mark', async () => {
    await layout(1000, { 'data-expanded': 'true' });
    expect(parseFloat(await css('#tlbl', 'font-size'))).toBeGreaterThan(parseFloat(await css('#lbl', 'font-size')));
    expect((await rect('#tmark')).w).toBeGreaterThan((await rect('#imark')).w);
  });

  it('still fits the collapsed icon strip', async () => {
    await layout(1000, { 'data-expanded': 'false' });
    const strip = await rect('#D');
    const mark = await rect('#tmark');
    expect(mark.x).toBeGreaterThanOrEqual(strip.x);
    expect(mark.x + mark.w).toBeLessThanOrEqual(strip.x + strip.w - 1); // inside, clear of the border
  });
});
