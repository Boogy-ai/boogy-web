// The segmented ChoiceGroup and the count badge, in a real layout engine.
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
  await page.setViewport({ width: 800, height: 400 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0;font-family:var(--font-body)"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    const still = new CSSStyleSheet();
    still.replaceSync('*, *::before, *::after { transition: none !important; }');
    document.adoptedStyleSheets = [sheet, still];
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});
afterAll(async () => { await browser?.close(); });

const segmented = (fill: boolean) => `
  <fieldset id="G" data-boogy="choice-group" data-variant="segmented" ${fill ? 'data-fill="true"' : ''} style="width:360px">
    <legend>Lasts</legend>
    <div data-slot="choices">
      <div data-slot="choice"><input id="a" type="radio" name="d" value="1"><label id="la" for="a" data-slot="choice-label">1 day</label></div>
      <div data-slot="choice"><input id="b" type="radio" name="d" value="7" checked><label id="lb" for="b" data-slot="choice-label">7 days</label></div>
      <div data-slot="choice"><input id="c" type="radio" name="d" value="30"><label id="lc" for="c" data-slot="choice-label">30 days<data data-boogy="count" value="3">3</data></label></div>
    </div>
  </fieldset>`;

describe('a segmented ChoiceGroup', () => {
  it('draws its choices in one row on one track; the chosen one filled, the others not', async () => {
    await page.evaluate((html) => { document.body.innerHTML = html; }, segmented(false));
    const r = await page.evaluate(() => {
      const box = (id: string) => document.getElementById(id)!.getBoundingClientRect();
      const bg = (id: string) => getComputedStyle(document.getElementById(id)!).backgroundColor;
      const track = document.querySelector('[data-slot="choices"]')!;
      return {
        tops: ['la', 'lb', 'lc'].map((id) => Math.round(box(id).top)),
        lefts: ['la', 'lb', 'lc'].map((id) => box(id).left),
        trackBg: getComputedStyle(track).backgroundColor,
        trackWidth: track.getBoundingClientRect().width,
        chosen: bg('lb'), other: bg('la'),
        radioWidth: document.getElementById('a')!.getBoundingClientRect().width,
      };
    });
    expect(new Set(r.tops).size).toBe(1);
    expect(r.lefts[0]).toBeLessThan(r.lefts[1]);
    expect(r.lefts[1]).toBeLessThan(r.lefts[2]);
    expect(r.trackBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(r.trackWidth).toBeLessThan(360);
    expect(r.chosen).not.toBe(r.other);
    expect(r.other).toBe('rgba(0, 0, 0, 0)');
  });

  it('fill: the track takes the width and the segments share it evenly', async () => {
    await page.evaluate((html) => { document.body.innerHTML = html; }, segmented(true));
    const w = await page.evaluate(() => ['la', 'lb', 'lc'].map((id) => document.getElementById(id)!.getBoundingClientRect().width));
    expect(Math.max(...w) - Math.min(...w)).toBeLessThan(1);
    const track = await page.$eval('[data-slot="choices"]', (el) => el.getBoundingClientRect().width);
    expect(track).toBeGreaterThan(355);
  });

  it('pressing a segment chooses its radio', async () => {
    await page.evaluate((html) => { document.body.innerHTML = html; }, segmented(true));
    await page.click('#lc');
    expect(await page.$eval('#c', (el) => (el as HTMLInputElement).checked)).toBe(true);
  });
});

describe('a count', () => {
  it('reads apart from its label: its own wash, a gap before it, shorter than the line', async () => {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div data-boogy="tab-list" role="tablist" style="width:600px">
          <button id="t1" data-slot="tab" role="tab" aria-selected="true">Members<data id="c1" data-boogy="count" value="10003">10K</data></button>
          <button id="t2" data-slot="tab" role="tab" aria-selected="false">Invites<data id="c2" data-boogy="count" value="6">6</data></button>
        </div>`;
    });
    const r = await page.evaluate(() => {
      const range = document.createRange();
      const t1 = document.getElementById('t1')!;
      range.selectNodeContents(t1.firstChild!);
      const text = range.getBoundingClientRect();
      const c1 = document.getElementById('c1')!.getBoundingClientRect();
      const cs = (id: string) => getComputedStyle(document.getElementById(id)!);
      return { gap: c1.left - text.right, countH: c1.height, textH: text.height, on: cs('c1').backgroundColor, off: cs('c2').backgroundColor, onInk: cs('c1').color, offInk: cs('c2').color };
    });
    expect(r.gap).toBeGreaterThan(2);
    expect(r.countH).toBeLessThan(r.textH + 2);
    expect(r.off).not.toBe('rgba(0, 0, 0, 0)');
    expect(r.on).not.toBe(r.off);
    expect(r.onInk).not.toBe(r.offInk);
  });
});
