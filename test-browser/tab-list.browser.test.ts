// A row of tabs in a real layout engine, as Android's scrollable tabs behave:
// when its tabs fit, they share the row; when they do not, the row scrolls
// sideways with no scrollbar, each tab keeps its label whole, the row fades out
// at a side with more beyond it, and choosing a tab brings it to the middle.
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
      lib: { entry: fileURLToPath(new URL('./fixtures/tab-list.fixture.tsx', import.meta.url)), formats: ['iife'], name: 'TabListFixtureBundle' },
    },
  });
  const result = Array.isArray(out) ? out[0] : out;
  const chunk = (result as { output: { type: string; code?: string }[] }).output.find((o) => o.type === 'chunk');
  return chunk!.code!;
}

type Report = {
  scrollWidth: number; clientWidth: number; scrollLeft: number; scrollbar: number;
  left: boolean; right: boolean; clipped: number; widths: number[]; selectedOffCentre: number; selectedInView: boolean;
};
type Fixture = { mount(w: number, fill: boolean, fresh?: boolean): void; resize(w: number): void; scrollTo(x: number): void; select(i: number): void; report(): Report };
const fx = <T>(f: (x: Fixture) => T) => page.evaluate((src) => (0, eval)(src)((window as unknown as { tabListFixture: Fixture }).tabListFixture), f.toString()) as Promise<T>;
const settle = () => page.evaluate(() => new Promise((r) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 700)));
async function mount(width: number, fill: boolean, fresh = false): Promise<Report> {
  await page.evaluate((w, f, n) => (window as unknown as { tabListFixture: Fixture }).tabListFixture.mount(w, f, n), width, fill, fresh);
  await settle();
  return fx((x) => x.report());
}

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  const code = await bundle();
  browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 800 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.evaluate((c) => { document.documentElement.style.fontSize = '16px'; (0, eval)(c); }, code);
}, 60_000);

afterAll(async () => { await browser?.close(); });

describe('a row of tabs in a real layout', () => {
  it('when the tabs fit, a filled row shares its width among them and neither scrolls nor fades', async () => {
    const r = await mount(1300, true);
    expect(r.scrollWidth).toBe(r.clientWidth);
    expect([r.left, r.right]).toEqual([false, false]);
    expect(Math.max(...r.widths) - Math.min(...r.widths)).toBeLessThanOrEqual(2);
  });

  for (const fill of [true, false]) {
    it(`when they do not fit (fill ${fill}), the row scrolls with no scrollbar, each label whole, fading at the side with more`, async () => {
      const r = await mount(300, fill);
      expect(r.scrollWidth).toBeGreaterThan(r.clientWidth);
      expect(r.scrollbar).toBe(0);
      expect(r.clipped).toBe(0);
      expect([r.left, r.right]).toEqual([false, true]);
      await page.evaluate(() => (window as unknown as { tabListFixture: Fixture }).tabListFixture.scrollTo(150));
      await settle();
      expect(await fx((x) => [x.report().left, x.report().right])).toEqual([true, true]);
      await page.evaluate(() => (window as unknown as { tabListFixture: Fixture }).tabListFixture.scrollTo(100000));
      await settle();
      expect(await fx((x) => [x.report().left, x.report().right])).toEqual([true, false]);
    });
  }

  it('choosing a tab brings it to the middle of the row (as far as the row can scroll)', async () => {
    await mount(300, true);
    await page.evaluate(() => (window as unknown as { tabListFixture: Fixture }).tabListFixture.select(4));
    await settle();
    const r = await fx((x) => x.report());
    expect(r.selectedInView).toBe(true);
    expect(Math.abs(r.selectedOffCentre)).toBeLessThanOrEqual(2);
    // The last tab: the row scrolls to its end, the tab whole and in view.
    await page.evaluate(() => (window as unknown as { tabListFixture: Fixture }).tabListFixture.select(7));
    await settle();
    const end = await fx((x) => x.report());
    expect(end.selectedInView).toBe(true);
    expect([end.left, end.right]).toEqual([true, false]);
  });

  // A mouse has no sideways swipe: its wheel and a drag must move the row, as a
  // finger does on a phone.
  const row = async () => (await page.$('[data-boogy="tab-list"]'))!.boundingBox().then((b) => b!);
  const scrollLeft = () => fx((x) => x.report().scrollLeft);
  const selectedIndex = () => page.evaluate(() =>
    [...document.querySelectorAll('[role="tab"]')].findIndex((t) => t.getAttribute('aria-selected') === 'true'));

  it('a mouse wheel turned over a row that does not fit scrolls it sideways', async () => {
    await mount(300, true);
    const b = await row();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel({ deltaY: 120 });
    await settle();
    expect(await scrollLeft()).toBeGreaterThanOrEqual(100);
    await page.mouse.wheel({ deltaY: -120 });
    await settle();
    expect(await scrollLeft()).toBe(0);
  });

  it('at the end of the row, or over a row that fits, the wheel scrolls the page', async () => {
    for (const width of [300, 1300]) {
      await mount(width, true);
      await page.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<div style="height:3000px"></div>'); scrollTo(0, 0); });
      await page.evaluate(() => (window as unknown as { tabListFixture: Fixture }).tabListFixture.scrollTo(100000));
      await settle();
      const before = await scrollLeft();
      const b = await row();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.wheel({ deltaY: 120 });
      await settle();
      expect(await scrollLeft()).toBe(before);
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    }
  });

  // `fresh`: the tabs a new array on every render, the parent rendering again
  // on every scroll, as an app that shows the scroll position does.
  for (const fresh of [false, true]) {
    it(`dragging the row with a mouse scrolls it, and chooses no tab (fresh tabs every render: ${fresh})`, async () => {
      await mount(300, true, fresh);
      const b = await row();
      const y = b.y + b.height / 2;
      await page.mouse.move(b.x + b.width - 20, y);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + b.width - 20 - i * 10, y);
      await page.mouse.up();
      await settle();
      expect(await scrollLeft()).toBeGreaterThanOrEqual(110);
      expect(await selectedIndex()).toBe(0);
    });
  }

  it('a click that does not drag still chooses the tab', async () => {
    await mount(300, true);
    const t = (await (await page.$$('[role="tab"]'))[1].boundingBox())!;
    await page.mouse.click(t.x + t.width / 2, t.y + t.height / 2);
    await settle();
    expect(await selectedIndex()).toBe(1);
  });

  it('widening the box until the tabs fit takes the fades away', async () => {
    await mount(300, true);
    await page.evaluate(() => (window as unknown as { tabListFixture: Fixture }).tabListFixture.resize(1300));
    await settle();
    expect(await fx((x) => [x.report().left, x.report().right])).toEqual([false, false]);
  });
});
