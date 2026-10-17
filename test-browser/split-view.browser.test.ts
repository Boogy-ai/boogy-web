// SplitView in a real layout engine: columns when it is wide, tabs and one
// region when it is narrow, decided by its own width, filling its height.
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
  // The window is wide: only the layout's own width may decide.
  await page.setViewport({ width: 1600, height: 900 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    document.adoptedStyleSheets = [sheet];
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});
afterAll(async () => { await browser?.close(); });

async function at(width: number, selected: 'm' | 'i' = 'm') {
  await page.evaluate(({ width, selected }) => {
    document.body.innerHTML = `
      <div style="width:${width}px;height:600px;display:flex;flex-direction:column">
        <div id="S" data-boogy="split-view" data-collapse-at="lg">
          <div id="T" data-slot="tabs"><div data-boogy="tab-list" role="tablist"><button data-slot="tab" role="tab">Members</button><button data-slot="tab" role="tab">Invites</button></div></div>
          <div id="R" data-slot="regions">
            <div id="M" data-slot="region" data-region="m" ${selected === 'm' ? 'data-selected' : ''}><section data-boogy="panel" data-grow="true"><div data-slot="body">members</div></section></div>
            <div id="I" data-slot="region" data-region="i" data-aside ${selected === 'i' ? 'data-selected' : ''}><section data-boogy="panel" data-grow="true"><div data-slot="body">invites</div></section></div>
          </div>
        </div>
      </div>`;
  }, { width, selected });
  return page.evaluate(() => {
    const box = (id: string) => {
      const b = document.getElementById(id)!.getBoundingClientRect();
      return { top: b.top, left: b.left, right: b.right, width: b.width, height: b.height };
    };
    const shown = (id: string) => getComputedStyle(document.getElementById(id)!).display !== 'none';
    return { tabs: shown('T'), m: shown('M'), i: shown('I'), M: box('M'), I: box('I'), S: box('S'), R: box('R') };
  });
}

describe('SplitView', () => {
  it('wide: no tabs; the regions side by side, the aside at its own width, both the full height', async () => {
    const r = await at(1100);
    expect(r.tabs).toBe(false);
    expect(r.m && r.i).toBe(true);
    expect(r.M.top).toBeCloseTo(r.I.top, 0);
    expect(r.I.left).toBeGreaterThan(r.M.right);
    expect(r.I.width).toBeCloseTo(360, 0);
    expect(r.M.width).toBeGreaterThan(r.I.width);
    expect(r.M.height).toBeCloseTo(r.I.height, 0);
    expect(r.S.height).toBeCloseTo(600, 0);
  });

  it('narrow, in a wide window: the tabs, and only the selected region, the full width', async () => {
    const r = await at(420);
    expect(r.tabs).toBe(true);
    expect(r.m).toBe(true);
    expect(r.i).toBe(false);
    expect(r.M.width).toBeGreaterThan(380);
    expect(r.S.height).toBeCloseTo(600, 0);
    const other = await at(420, 'i');
    expect(other.m).toBe(false);
    expect(other.i).toBe(true);
    expect(other.I.width).toBeGreaterThan(380);
  });
});
