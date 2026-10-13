// A TabPager in a real browser, under a row of tabs, turned by a finger: raw
// touch events (a press, moves a frame apart, a lift), so the swipe is the
// browser's own scroll, as on a phone. A fling turns one page and the row's
// line follows it to the new tab; a swipe that starts inside a framed page
// from another origin turns the page all the same; a short slow drag snaps
// back; and a tab pressed while a swipe settles wins over the swipe.
//
// Raw touch, not a synthesized scroll gesture: headless Chromium does not
// scroll for a synthesized touch gesture at all.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type CDPSession, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { bundleFixture } from '../test-support/bundle-fixture';

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
let browser: Browser;
let page: Page;
let cdp: CDPSession;
const servers: Server[] = [];
let framedUrl = '';

/** One page, served over HTTP on a port of its own. */
async function serve(html: string): Promise<number> {
  const server = createServer((_req, res) => { res.setHeader('content-type', 'text/html'); res.end(html); });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return (server.address() as AddressInfo).port;
}

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  const code = await bundleFixture('../test-browser/fixtures/tab-pager.fixture.tsx', 'TabPagerFixtureBundle');
  // Two origins: the page at localhost, the framed page at 127.0.0.1. The
  // framed page scrolls down, never sideways, as most content does.
  const mainPort = await serve('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"></body></html>');
  framedUrl = `http://127.0.0.1:${await serve('<!doctype html><body style="margin:0;height:200vh">A framed page</body>')}/`;
  browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 400, height: 700, hasTouch: true, isMobile: true });
  await page.goto(`http://localhost:${mainPort}/`);
  await page.evaluate((c) => { document.documentElement.style.fontSize = '16px'; (0, eval)(c); }, code);
  cdp = await page.createCDPSession();
}, 60_000);

afterAll(async () => {
  await browser?.close();
  for (const s of servers) s.close();
});

type Box = { left: number; top: number; width: number; height: number };
type Report = { pager: Box; page: number; reported: number[]; index: number; selected: number; line: Box; tabs: Box[] };
type Fixture = { mount(frame?: string): void; select(i: number): void; report(): Report };
const fixture = () => (window as unknown as { tabPagerFixture: Fixture }).tabPagerFixture;
const report = () => page.evaluate(`(${fixture})().report()`) as Promise<Report>;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mount(frame?: string): Promise<Report> {
  await page.evaluate(`(${fixture})().mount(${JSON.stringify(frame)})`);
  if (frame) {
    await page.waitForFrame((f) => f.url() === frame);
    await pause(300);
  }
  return settled();
}

/** Until the pager has stopped (a dozen frames with no scroll) and its owner has
 *  heard of where it stopped. */
async function settled(): Promise<Report> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    const pager = document.getElementById('pages')!;
    const start = performance.now();
    let last = Number.NaN;
    let still = 0;
    const tick = () => {
      still = pager.scrollLeft === last ? still + 1 : 0;
      last = pager.scrollLeft;
      if (still >= 12 || performance.now() - start > 4000) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  await pause(150);
  return report();
}

const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });

/** A finger pressed at (x, y), moved `dx` to the left in `steps` moves `ms`
 *  apart; lifted unless `hold`. */
async function swipe(x: number, y: number, dx: number, steps: number, ms: number, hold = false) {
  await touch('touchStart', x, y);
  for (let i = 1; i <= steps; i++) {
    await pause(ms);
    await touch('touchMove', x - (dx * i) / steps, y);
  }
  if (!hold) await touch('touchEnd');
}
/** A quick flick: 300px in a tenth of a second, a move every frame. */
const fling = (x: number, y: number) => swipe(x, y, 300, 6, 16);

describe('a TabPager under a row of tabs, turned by a finger', () => {
  it('a fling turns exactly one page, which its owner hears of once, and the row\'s line ends under the new tab', async () => {
    const r = await mount();
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    expect([r.page, r.selected]).toEqual([0, 0]);
    await fling(r.pager.left + 300, r.pager.top + 150);
    const after = await settled();
    expect(after.page).toBe(1);
    expect(after.reported).toEqual([1]);
    expect([after.index, after.selected]).toEqual([1, 1]);
    expect(Math.abs(after.line.left - after.tabs[1].left)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.line.width - after.tabs[1].width)).toBeLessThanOrEqual(1);
  });

  it('while a finger holds the pager between two pages, the line lies between their two tabs', async () => {
    const r = await mount();
    await swipe(r.pager.left + 350, r.pager.top + 150, 220, 11, 30, true);
    await pause(100);
    const held = await report();
    await touch('touchEnd');
    await settled();
    expect(held.page).toBeGreaterThan(0.2);
    expect(held.page).toBeLessThan(0.8);
    expect(held.line.left).toBeGreaterThan(held.tabs[0].left + 1);
    expect(held.line.left).toBeLessThan(held.tabs[1].left - 1);
  });

  it('a fling that starts inside a framed page from another origin turns exactly one page', async () => {
    const r = await mount(framedUrl);
    const x = r.pager.left + 300;
    const y = r.pager.top + 150;
    // The finger lands on the frame, and the frame is another origin's.
    expect(await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.tagName, [x, y])).toBe('IFRAME');
    expect(new URL(framedUrl).origin).not.toBe(new URL(page.url()).origin);
    await fling(x, y);
    const after = await settled();
    expect(after.page).toBe(1);
    expect(after.reported).toEqual([1]);
    expect(after.selected).toBe(1);
  });

  it('a slow short drag snaps back to the page it started on, and its owner hears nothing', async () => {
    const r = await mount();
    await swipe(r.pager.left + 300, r.pager.top + 150, 40, 10, 60);
    const after = await settled();
    expect(after.page).toBe(0);
    expect(after.reported).toEqual([]);
    expect(after.selected).toBe(0);
  });

  it('a tab pressed while a swipe is still settling lands on its page and stays there', async () => {
    const r = await mount();
    await fling(r.pager.left + 300, r.pager.top + 150);
    await page.evaluate(`(${fixture})().select(2)`);
    const pressed = await report();
    const after = await settled();
    // Pressed mid-swipe: the pager between its first two pages, nothing settled yet.
    expect(pressed.page).toBeGreaterThan(0);
    expect(pressed.page).toBeLessThan(1);
    expect(pressed.reported).toEqual([]);
    expect(after.page).toBe(2);
    expect([after.index, after.selected]).toEqual([2, 2]);
    // The owner heard of the page from the press alone: the swipe reported
    // nothing, neither the page it was heading for nor the pressed one again.
    expect(after.reported).toEqual([]);
    expect(Math.abs(after.line.left - after.tabs[2].left)).toBeLessThanOrEqual(1);
  });
});
