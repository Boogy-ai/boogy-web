// TopBar in a real layout engine: as its box narrows, its actions move into
// the More menu lowest priority first, and come back as it widens; at 150%
// zoom the same holds at the larger size; and the zoom control, which lives in
// the menu, changes the zoom from inside the open menu and leaves it open.
// The component is bundled here with Preact, as an app would ship it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
let browser: Browser;
let page: Page;

async function bundle(): Promise<string> {
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    root: fileURLToPath(new URL('..', import.meta.url)),
    resolve: { alias: [{ find: /^@boogy\/web$/, replacement: fileURLToPath(new URL('../src/index.ts', import.meta.url)) }] },
    oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL('./fixtures/top-bar.fixture.tsx', import.meta.url)), formats: ['iife'], name: 'TopBarFixtureBundle' },
    },
  });
  const result = Array.isArray(out) ? out[0] : out;
  const chunk = (result as { output: { type: string; code?: string }[] }).output.find((o) => o.type === 'chunk');
  return chunk!.code!;
}

type Report = { shown: string[]; more: boolean; clear: boolean; spills: boolean; fontPx: number; itemStyle: string[] };
const report = () => page.evaluate(() => (window as unknown as { topBarFixture: { report(): Report } }).topBarFixture.report());
const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
async function at(width: number): Promise<Report> {
  await page.evaluate((w) => (window as unknown as { topBarFixture: { resize(w: number): void } }).topBarFixture.resize(w), width);
  await frames();
  return report();
}
const ORDER = ['edit', 'links', 'present', 'close', 'delete'];
/** The shown actions are always the most important ones: a prefix of the order. */
const isPrefix = (shown: string[]) => shown.every((id, i) => id === ORDER[i]);

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  const code = await bundle();
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 800 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.evaluate((c) => { document.documentElement.style.fontSize = '16px'; (0, eval)(c); }, code);
  await page.evaluate(() => (window as unknown as { topBarFixture: { mount(w: number): void } }).topBarFixture.mount(1300));
  await frames();
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

describe('TopBar in a real layout', () => {
  it('lays an item out the same in the bar and in the row that measures it: a flex box that never shrinks, its content centred', async () => {
    const r = await at(1300);
    expect(r.itemStyle).toEqual(['flex 0 center', 'flex 0 center']);
  });

  it('as the bar narrows, actions leave lowest priority first; as it widens they come back; nothing overlaps', async () => {
    const widths = [1300, 700, 560, 480, 420, 360, 300];
    const narrowing: Report[] = [];
    for (const w of widths) narrowing.push(await at(w));
    const counts = narrowing.map((r) => r.shown.length);
    expect(counts[0]).toBe(5);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    expect(counts.at(-1)!).toBeLessThan(5);
    for (const r of narrowing) {
      expect(isPrefix(r.shown)).toBe(true);
      expect(r.more).toBe(true); // the size control lives in the menu
      expect(r.clear).toBe(true);
      expect(r.spills).toBe(false);
    }
    const widening: Report[] = [];
    for (const w of [...widths].reverse()) widening.push(await at(w));
    expect(widening.map((r) => r.shown.length)).toEqual([...counts].reverse());
  });

  it('at 150% zoom the text is half as big again, fewer actions fit the same bar, and the rule still holds', async () => {
    const plain = await at(700);
    await page.evaluate(() => (window as unknown as { topBarFixture: { hostZoom(f: number): void } }).topBarFixture.hostZoom(1.5));
    await frames();
    const zoomed = await at(700);
    expect(zoomed.fontPx / plain.fontPx).toBeCloseTo(1.5, 1);
    expect(zoomed.shown.length).toBeLessThan(plain.shown.length);
    expect(isPrefix(zoomed.shown)).toBe(true);
    expect(zoomed.clear).toBe(true);
    expect(zoomed.spills).toBe(false);
    await page.evaluate(() => (window as unknown as { topBarFixture: { hostZoom(f: number): void } }).topBarFixture.hostZoom(1));
    await frames();
  });

  it('the size control lives in the open menu: Larger changes the zoom there and the menu stays open', async () => {
    await at(1300);
    await page.click('[data-boogy="top-bar"] [data-slot="more"]');
    await frames();
    expect(await page.$eval('[data-boogy="top-bar"] [data-slot="more"]', (b) => b.getAttribute('aria-expanded'))).toBe('true');
    const row = await page.$eval('[role="menu"] [role="group"]', (g) => ({ label: g.getAttribute('aria-label'), roles: [...g.querySelectorAll('button')].map((b) => b.getAttribute('role')) }));
    expect(row).toEqual({ label: 'Text size', roles: ['menuitem', 'menuitem'] });
    const before = await page.evaluate(() => (window as unknown as { topBarFixture: { zoom(): number } }).topBarFixture.zoom());
    await page.click('[role="menu"] button[aria-label="Larger"]');
    await frames();
    const after = await page.evaluate(() => (window as unknown as { topBarFixture: { zoom(): number } }).topBarFixture.zoom());
    expect(after).toBeGreaterThan(before);
    expect(await page.$('[role="menu"]')).not.toBeNull();
    expect(await page.$eval('[data-boogy="top-bar"] [data-slot="more"]', (b) => b.getAttribute('aria-expanded'))).toBe('true');
    // From the keyboard, too: Larger again with Enter, and the menu still open.
    await page.focus('[role="menu"] button[aria-label="Larger"]');
    await page.keyboard.press('Enter');
    await frames();
    expect(await page.evaluate(() => (window as unknown as { topBarFixture: { zoom(): number } }).topBarFixture.zoom())).toBeGreaterThan(after);
    expect(await page.$('[role="menu"]')).not.toBeNull();
    await page.keyboard.press('Escape');
    await frames();
    expect(await page.$('[role="menu"]')).toBeNull();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-slot'))).toBe('more');
  });

  it('focus stays in the menu when Larger reaches the largest size and turns itself off; the arrows still move', async () => {
    await at(360);
    await page.click('[data-boogy="top-bar"] [data-slot="more"]');
    await frames();
    await page.focus('[role="menu"] button[aria-label="Larger"]');
    for (let i = 0; i < 8; i++) {
      if (await page.$eval('[role="menu"] button[aria-label="Larger"]', (b) => (b as HTMLButtonElement).disabled)) break;
      await page.keyboard.press('Enter');
      await frames();
    }
    expect(await page.$eval('[role="menu"] button[aria-label="Larger"]', (b) => (b as HTMLButtonElement).disabled)).toBe(true);
    const where = await page.evaluate(() => ({ inMenu: !!document.activeElement?.closest('[role="menu"]'), name: document.activeElement?.getAttribute('aria-label') }));
    expect(where).toEqual({ inMenu: true, name: 'Smaller' });
    // The arrows still move: up to the row above the size control.
    await page.keyboard.press('ArrowUp');
    await frames();
    expect(await page.evaluate(() => ({ inMenu: !!document.activeElement?.closest('[role="menu"]'), text: document.activeElement?.textContent }))).toEqual({ inMenu: true, text: 'Delete' });
    // Back to the page's own size, with Smaller.
    for (let i = 0; i < 8; i++) {
      const smaller = await page.$('[role="menu"] button[aria-label="Smaller"]');
      if (!smaller || (await smaller.evaluate((b) => (b as HTMLButtonElement).disabled))) break;
      if ((await page.evaluate(() => (window as unknown as { topBarFixture: { zoom(): number } }).topBarFixture.zoom())) <= 1) break;
      await smaller.click();
      await frames();
    }
  });
});
