// ColumnChart's segment gaps: a column's segments stand a gap apart, and the
// most gaps any column draws are taken off the height before the data is
// scaled into it, so every column is on one scale and none overflows the chart.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { bundleFixture } from '../test-support/bundle-fixture';

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
let browser: Browser;
let page: Page;

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  const code = await bundleFixture('../test-browser/fixtures/column-chart.fixture.tsx', 'ColumnChartFixtureBundle');
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 800, height: 400 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.evaluate((c) => { document.documentElement.style.fontSize = '16px'; (0, eval)(c); }, code);
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

describe('ColumnChart segment gaps', () => {
  it('scales every column by one unit of height, the gaps of the tallest column taken off', async () => {
    const seg = (value: number, label: string) => ({ value, color: 'red', label });
    // The tallest column (4) is two segments with one gap between; the other
    // (2) is one segment. Per unit of value, both must be the same height.
    await page.evaluate((cols) => (window as unknown as { columnChartFixture: { mount(w: number, c: unknown): void } }).columnChartFixture.mount(600, cols), [
      { label: 'a', segments: [seg(3, 'x'), seg(1, 'y')] },
      { label: 'b', segments: [seg(2, 'x')] },
    ]);
    await frames();
    const m = await page.evaluate(() => {
      const cols = [...document.querySelectorAll('[data-boogy="column-chart"] [data-slot="column"]')];
      const h = (el: Element) => el.getBoundingClientRect().height;
      const segs = cols.map((c) => [...c.querySelectorAll('[data-slot="segment"]')].map(h));
      const gap = parseFloat(getComputedStyle(cols[0]).rowGap);
      return { segs, gap, chart: h(cols[0]) };
    });
    const unit = m.segs[0][0] / 3;
    expect(m.gap).toBeGreaterThan(0);
    expect(Math.abs(m.segs[0][1] - unit)).toBeLessThan(0.25);
    expect(Math.abs(m.segs[1][0] - 2 * unit)).toBeLessThan(0.25);
    // The tallest column fills the chart: its segments and its one gap.
    expect(Math.abs(m.segs[0][0] + m.segs[0][1] + m.gap - m.chart)).toBeLessThan(0.25);
  });

  it('keeps a near-tallest column with more segments on the same scale, inside the chart', async () => {
    const seg = (value: number, label: string) => ({ value, color: 'red', label });
    // The tallest column (10) is one segment, no gap; the next (9.9) is three,
    // two gaps. Sized from the tallest's gaps alone, the second overflows and
    // the browser shrinks it off the scale every other column stands on.
    await page.evaluate((cols) => (window as unknown as { columnChartFixture: { mount(w: number, c: unknown): void } }).columnChartFixture.mount(600, cols), [
      { label: 'a', segments: [seg(10, 'x')] },
      { label: 'b', segments: [seg(3, 'x'), seg(3, 'y'), seg(3.9, 'z')] },
    ]);
    await frames();
    const m = await page.evaluate(() => {
      const cols = [...document.querySelectorAll('[data-boogy="column-chart"] [data-slot="column"]')];
      const h = (el: Element) => el.getBoundingClientRect().height;
      const segs = cols.map((c) => [...c.querySelectorAll('[data-slot="segment"]')].map(h));
      const gap = parseFloat(getComputedStyle(cols[0]).rowGap);
      return { segs, gap, chart: h(cols[0]) };
    });
    const unit = m.segs[0][0] / 10;
    expect(m.gap).toBeGreaterThan(0);
    // Every segment of b on a's scale.
    for (const [i, v] of [3, 3, 3.9].entries()) expect(Math.abs(m.segs[1][i] - v * unit)).toBeLessThan(0.25);
    // And b, with its two gaps, inside the chart.
    expect(m.segs[1].reduce((a, b) => a + b, 0) + 2 * m.gap).toBeLessThanOrEqual(m.chart + 0.25);
  });

  it('draws the gaps and takes them off the height from one property, so a wider gap still fills the chart', async () => {
    const seg = (value: number, label: string) => ({ value, color: 'red', label });
    await page.evaluate((cols) => (window as unknown as { columnChartFixture: { mount(w: number, c: unknown): void } }).columnChartFixture.mount(600, cols), [
      { label: 'a', segments: [seg(3, 'x'), seg(1, 'y')] },
      { label: 'b', segments: [seg(2, 'x')] },
    ]);
    const narrow = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-boogy="column-chart"] [data-slot="column"]')!).rowGap));
    await page.evaluate(() => document.querySelector<HTMLElement>('[data-boogy="column-chart"]')!.style.setProperty('--chart-segment-gap', 'var(--space-3)'));
    await frames();
    const m = await page.evaluate(() => {
      const cols = [...document.querySelectorAll('[data-boogy="column-chart"] [data-slot="column"]')];
      const h = (el: Element) => el.getBoundingClientRect().height;
      const segs = cols.map((c) => [...c.querySelectorAll('[data-slot="segment"]')].map(h));
      return { segs, gap: parseFloat(getComputedStyle(cols[0]).rowGap), chart: h(cols[0]) };
    });
    expect(m.gap).toBeGreaterThan(narrow);
    const unit = m.segs[0][0] / 3;
    expect(Math.abs(m.segs[0][1] - unit)).toBeLessThan(0.25);
    expect(Math.abs(m.segs[1][0] - 2 * unit)).toBeLessThan(0.25);
    expect(Math.abs(m.segs[0][0] + m.segs[0][1] + m.gap - m.chart)).toBeLessThan(0.25);
  });
});
