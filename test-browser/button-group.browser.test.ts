// The size controls and ButtonGroup in a real layout engine: the group's outer
// corners take the buttons' radius (fully round when `rounded`), every corner at
// the seam is square, a faint hairline marks the seam, and the zoom buttons hold
// the SDK's glyphs. With BOOGY_SHOTS_DIR set it saves screenshots, light and
// dark, for a person to look at.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
const SHOTS = process.env.BOOGY_SHOTS_DIR;
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
      lib: { entry: fileURLToPath(new URL('./fixtures/button-group.fixture.tsx', import.meta.url)), formats: ['iife'], name: 'ButtonGroupFixtureBundle' },
    },
  });
  const result = Array.isArray(out) ? out[0] : out;
  return (result as { output: { type: string; code?: string }[] }).output.find((o) => o.type === 'chunk')!.code!;
}

type Report = {
  unit: number;
  groups: { a: number[]; b: number[]; aHeight: number; gap: number; seamA: number; seamB: number; seamColor: string; overflow: string }[];
  zoomGlyphs: number[];
  zoomLetters: number;
};
const report = () => page.evaluate(() => (window as unknown as { buttonGroupFixture: { report(): Report } }).buttonGroupFixture.report());
const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  const code = await bundle();
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 420, height: 140, deviceScaleFactor: 4 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0;background:var(--ground-sunken);color:var(--text-1);font-family:var(--font-body)"></body></html>');
  await page.evaluate((c) => { document.documentElement.style.fontSize = '16px'; (0, eval)(c); }, code);
  await page.evaluate(() => (window as unknown as { buttonGroupFixture: { mount(): void } }).buttonGroupFixture.mount());
  await frames();
}, 60_000);
afterAll(async () => { await browser?.close(); });

describe('ButtonGroup in a real layout engine', () => {
  it('rounded: the left of the first and the right of the last are fully round, the seam corners are square', async () => {
    const [g] = (await report()).groups;
    const half = g.aHeight / 2;
    expect(g.a[0]).toBeGreaterThanOrEqual(half); expect(g.a[3]).toBeGreaterThanOrEqual(half);
    expect(g.a[1]).toBe(0); expect(g.a[2]).toBe(0);
    expect(g.b[0]).toBe(0); expect(g.b[3]).toBe(0);
    expect(g.b[1]).toBeGreaterThanOrEqual(half); expect(g.b[2]).toBeGreaterThanOrEqual(half);
  });
  it('not rounded: the outer corners take the standard radius, the seam stays square', async () => {
    const [, g] = (await report()).groups;
    expect(g.a[0]).toBeGreaterThan(0); expect(g.a[0]).toBeLessThan(g.aHeight / 2);
    expect(g.a[1]).toBe(0); expect(g.b[0]).toBe(0);
    expect(g.b[1]).toBe(g.a[0]);
  });
  it('sits edge to edge with a faint one-pixel seam on the second button only', async () => {
    const [g] = (await report()).groups;
    expect(g.gap).toBe(0);
    expect(g.seamA).toBe(0);
    expect(g.seamB).toBe(1);
    expect(g.seamColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(g.overflow).toBe('visible');
  });
});

describe('ZoomControls', () => {
  it('shows a glyph in each button at the icon size, and no letter', async () => {
    const r = await report();
    expect(r.zoomLetters).toBe(0);
    expect(r.zoomGlyphs).toHaveLength(2);
    for (const w of r.zoomGlyphs) expect(w).toBeCloseTo(1.25 * r.unit, 0);
  });
});

describe.runIf(!!SHOTS)('screenshots', () => {
  it('saves the size controls and the groups, dark and light', async () => {
    mkdirSync(SHOTS!, { recursive: true });
    for (const scheme of ['dark', 'light'] as const) {
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
      await frames();
      await page.screenshot({ path: join(SHOTS!, `size-and-groups-${scheme}.png`) });
    }
  });
});
