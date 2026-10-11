// TopBar in a real layout engine: as its box narrows, its actions move into
// the More menu lowest priority first, and come back as it widens; at 150%
// zoom the same holds at the larger size; and the zoom control, which lives in
// the menu, changes the zoom from inside the open menu and leaves it open.
// More's rows have a faint line between each two, and a submenu row opens its
// content beside the row, on the other side when there is no room.
// The component is bundled here with Preact, as an app would ship it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
// With BOOGY_SHOTS_DIR set, the More menu case also saves screenshots of More
// and of an open submenu beside it, light and dark, for a person to look at.
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

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type MenuRow = {
  kind: string; text: string; box: Box; paddingRight: number; background: string; expanded: string | null;
  icon: Box | null; label: Box | null; chevron: Box | null;
  line: { content: string; height: string; top: string; color: string; left: string; right: string };
};
type MenuReport = { more: Box | null; moreEdge: string | null; sub: Box | null; subPlacement: string | null; subHasPicker: boolean; focusInSub: boolean; rows: MenuRow[] };
const menuReport = () => page.evaluate(() => (window as unknown as { topBarMenuFixture: { menuReport(): MenuReport } }).topBarMenuFixture.menuReport());
async function openMenu(width: number, variant: 'flat' | 'raised' = 'raised'): Promise<MenuReport> {
  await page.evaluate((o) => (window as unknown as { topBarMenuFixture: { mountMenu(o: { width: number; variant: string }): void } }).topBarMenuFixture.mountMenu(o), { width, variant });
  await frames();
  await page.click('[data-boogy="top-bar"] [data-slot="more"]');
  await frames();
  return menuReport();
}
async function openSubmenu(): Promise<MenuReport> {
  await page.click('[role="menu"] [aria-haspopup="dialog"]');
  await frames();
  return menuReport();
}
/** The alpha of a computed colour (`rgba(…)`, `color(srgb … / a)`, `oklch(… / a)`); 1 when it has none. */
const alpha = (c: string) => {
  const m = /\/\s*([\d.]+)\)$/.exec(c) ?? /rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(c);
  return m ? Number(m[1]) : 1;
};
const near = (a: number, b: number, slack = 0.5) => Math.abs(a - b) <= slack;

describe('TopBar More: rows of every kind, and a submenu beside its row', () => {
  beforeAll(async () => {
    await page.setViewport({ width: 1100, height: 760, deviceScaleFactor: 2 });
    // The popover's entrance (a scale from 0.96) would be measured mid-way.
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  });

  it('a faint line sits in the gap between each two rows, none above the first, fainter than More\'s own edge', async () => {
    const r = await openMenu(480);
    expect(r.rows.map((row) => row.text)).toEqual(['Split into rows', 'Size', 'Colour', 'Copy link']);
    expect(r.rows.map((row) => row.kind)).toEqual(['menu-item', 'menu-row', 'menu-item', 'menu-item']);
    const [first, ...rest] = r.rows;
    expect(first.line.content).toBe('none');
    rest.forEach((row, i) => {
      const above = r.rows[i];
      expect(row.line.content).toBe('""');
      expect(row.line.height).toBe('1px');
      // In the gap: the line's 1px is exactly the space between the two rows.
      expect(near(row.box.top - above.box.bottom, 1, 0.01)).toBe(true);
      expect(row.line.top).toBe('-1px');
      expect([row.line.left, row.line.right]).toEqual(['0px', '0px']);
      expect(alpha(row.line.color)).toBeGreaterThan(0);
      expect(alpha(row.line.color)).toBeLessThan(alpha(r.moreEdge!));
    });
  });

  it("every row's glyph and label start where the others' do; the submenu row ends in its chevron at the row's end, centred on it", async () => {
    const r = await openMenu(480);
    const icons = r.rows.map((row) => row.icon!.left);
    const labels = r.rows.map((row) => row.label!.left);
    for (const x of icons) expect(near(x, icons[0])).toBe(true);
    for (const x of labels) expect(near(x, labels[0])).toBe(true);
    const sub = r.rows.find((row) => row.text === 'Colour')!;
    expect(sub.chevron).not.toBeNull();
    expect(near(sub.chevron!.right, sub.box.right - sub.paddingRight)).toBe(true);
    expect(near(sub.chevron!.top + sub.chevron!.height / 2, sub.box.top + sub.box.height / 2)).toBe(true);
    expect(near(sub.label!.top + sub.label!.height / 2, sub.box.top + sub.box.height / 2, 1)).toBe(true);
    expect(r.rows.filter((row) => row.chevron).map((row) => row.text)).toEqual(['Colour']);
  });

  it("a press on the row opens the content beside it, its top at the row's, focus inside; the row stays lit", async () => {
    await openMenu(480);
    const r = await openSubmenu();
    expect(r.subHasPicker).toBe(true);
    expect(r.focusInSub).toBe(true);
    expect(r.subPlacement).toBe('right');
    expect(r.sub!.left).toBeGreaterThanOrEqual(r.more!.right);
    const row = r.rows.find((x) => x.text === 'Colour')!;
    expect(row.expanded).toBe('true');
    expect(near(r.sub!.top, row.box.top)).toBe(true);
    expect(alpha(row.background)).toBeGreaterThan(0);
    // Escape closes it, focus back on the row, More still open. (Left on a swatch is the grid's own.)
    await page.keyboard.press('Escape');
    await frames();
    const after = await menuReport();
    expect(after.sub).toBeNull();
    expect(after.more).not.toBeNull();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup'))).toBe('dialog');
  });

  it('with no room to the right, the content opens on the left of More', async () => {
    await openMenu(1100);
    const r = await openSubmenu();
    expect(r.subPlacement).toBe('left');
    expect(r.sub!.right).toBeLessThanOrEqual(r.more!.left);
    expect(r.sub!.left).toBeGreaterThanOrEqual(0);
  });
});

describe.runIf(!!SHOTS)('TopBar More screenshots', () => {
  it('saves More, and More with its submenu open beside it, light and dark, raised and flat', async () => {
    mkdirSync(SHOTS!, { recursive: true });
    const pad = 16;
    const clipOf = (...boxes: Box[]) => {
      const left = Math.max(0, Math.min(...boxes.map((b) => b.left)) - pad);
      const top = Math.max(0, Math.min(...boxes.map((b) => b.top)) - pad);
      return { x: left, y: top, width: Math.max(...boxes.map((b) => b.right)) + pad - left, height: Math.max(...boxes.map((b) => b.bottom)) + pad - top };
    };
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
      for (const variant of ['raised', 'flat'] as const) {
        const r = await openMenu(480, variant);
        await page.screenshot({ path: join(SHOTS!, `more-${scheme}-${variant}.png`), clip: clipOf(r.more!) });
        const o = await openSubmenu();
        await page.screenshot({ path: join(SHOTS!, `more-submenu-${scheme}-${variant}.png`), clip: clipOf(o.more!, o.sub!) });
      }
    }
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  });
});
