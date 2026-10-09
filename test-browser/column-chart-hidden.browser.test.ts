// ColumnChart's visually hidden table, rendered by the component as an app
// renders it: it is read by a screen reader and draws nothing. Firefox lays a
// table's caption outside the table's own box, so a clip on the table leaves
// the caption drawn; the check is the page's pixels with and without it.
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

describe('ColumnChart, rendered by the component', () => {
  it('its hidden table, caption included, draws nothing: the page is the same pixels without it', async () => {
    await page.evaluate(() => (window as unknown as { columnChartFixture: { mount(w: number): void } }).columnChartFixture.mount(600));
    await frames();
    const caption = await page.$eval('figure[data-boogy="column-chart"] caption', (c) => c.textContent);
    expect(caption).toContain('Values over time');
    const shown = await page.screenshot({ encoding: 'base64' });
    // Hidden, not gone: removing the hidden content changes nothing drawn.
    await page.evaluate(() => {
      const t = document.querySelector('figure[data-boogy="column-chart"] table')!;
      (t.closest('[data-visually-hidden]') as HTMLElement).style.display = 'none';
    });
    await frames();
    const without = await page.screenshot({ encoding: 'base64' });
    expect(shown === without).toBe(true);
  });
});
