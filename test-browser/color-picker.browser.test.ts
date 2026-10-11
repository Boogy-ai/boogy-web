// ColorPicker in a real layout engine, opened in a Dropdown's popover as an
// app shows it: its sections sit inside the picker's padding with a hairline
// between each two, the swatches are a compact grid of square chips, the
// custom colour (area, hue strip, hex row) spans the picker's width, and the
// transparency slider is last. A real pointer drag and a real held key each
// commit once. The component is bundled here with Preact, as an app ships it.
//
// With BOOGY_SHOTS_DIR set, it also saves screenshots of the open picker,
// light and dark, flat and raised, for a person to look at.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { hexToHsv, hsvToHex, oklchToHex } from '../src/components/color-math';

// A missing browser FAILS the suite: a skipped measurement is not a pass.
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
      lib: { entry: fileURLToPath(new URL('./fixtures/color-picker.fixture.tsx', import.meta.url)), formats: ['iife'], name: 'ColorPickerFixtureBundle' },
    },
  });
  const result = Array.isArray(out) ? out[0] : out;
  const chunk = (result as { output: { type: string; code?: string }[] }).output.find((o) => o.type === 'chunk');
  return chunk!.code!;
}

type Box = { x: number; y: number; w: number; h: number; right: number; bottom: number };
type Report = {
  unit: number;
  popover: Box;
  picker: Box;
  sections: { slot: string; box: Box; padding: number[]; borderTop: number; borderTopColor: string }[];
  chips: Box[];
  chipRadius: number;
  area: Box;
  thumb: Box;
  hue: Box;
  preview: Box;
  hex: Box;
  hexValue: string;
  hexSpellcheck: string | null;
  slider: Box | null;
  sliderValue: string | null;
  areaBackground: string;
  hueTrack: string;
  focused: string | null;
};
type Fixture = {
  palette: string[];
  mount(o: { variant: 'flat' | 'raised'; value: string; opacity?: number; tokened?: boolean }): void;
  commits(): { value: string[]; opacity: number[] };
  report(): Report;
};
const fixture = <T>(fn: (f: Fixture) => T) => page.evaluate(`(${fn.toString()})(window.pickerFixture)`) as Promise<T>;
const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));

let palette: string[] = [];
async function open(o: { variant: 'flat' | 'raised'; value?: string; opacity?: number; tokened?: boolean }): Promise<Report> {
  await page.evaluate((opts) => (window as unknown as { pickerFixture: Fixture }).pickerFixture.mount(opts), { value: palette[25], ...o });
  await frames();
  return fixture((f) => f.report());
}
const report = () => fixture((f) => f.report());
const commits = () => fixture((f) => f.commits());
const near = (a: number, b: number, slack = 0.5) => Math.abs(a - b) <= slack;

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  const code = await bundle();
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 720, height: 900, deviceScaleFactor: 2 });
  // The popover's entrance (a scale from 0.96) would be measured mid-way.
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setContent('<!doctype html><html><head></head><body style="margin:0;background:var(--ground-sunken);color:var(--text-1);font-family:var(--font-body)"></body></html>');
  await page.evaluate((c) => { document.documentElement.style.fontSize = '16px'; (0, eval)(c); }, code);
  palette = await fixture((f) => f.palette);
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

describe('color picker layout', () => {
  it('stacks its sections top to bottom — swatches, custom colour, transparency — the slider last', async () => {
    const r = await open({ variant: 'flat', opacity: 33 });
    expect(r.sections.map((s) => s.slot)).toEqual(['swatches', 'custom', 'opacity']);
    for (let i = 1; i < r.sections.length; i++) expect(r.sections[i].box.y).toBeGreaterThanOrEqual(r.sections[i - 1].box.bottom - 0.5);
    expect(r.slider!.bottom).toBeLessThanOrEqual(r.picker.bottom);
    expect(r.slider!.y).toBeGreaterThan(r.hex.bottom);
  });

  it('pads every section by --space-3 on all four sides, inside the picker', async () => {
    const r = await open({ variant: 'flat', opacity: 33 });
    const space3 = 0.75 * r.unit;
    for (const s of r.sections) expect(s.padding, s.slot).toEqual([space3, space3, space3, space3]);
    // The first chip sits one padding in from the picker's corner, the slider one padding up from its bottom.
    expect(near(r.chips[0].x - r.picker.x, space3)).toBe(true);
    expect(near(r.chips[0].y - r.picker.y, space3)).toBe(true);
    expect(near(r.picker.bottom - r.slider!.bottom, space3)).toBe(true);
  });

  it('draws a hairline between each two sections, across the picker\'s full width, and none above the first', async () => {
    const r = await open({ variant: 'flat', opacity: 33 });
    expect(r.sections.map((s) => s.borderTop)).toEqual([0, 1, 1]);
    for (const s of r.sections.slice(1)) {
      expect(near(s.box.x, r.picker.x)).toBe(true);
      expect(near(s.box.w, r.picker.w)).toBe(true);
    }
  });

  it('lays the swatches out as a compact rectangular grid: 10 square chips a row, --chip-md each, a --space-0 gap', async () => {
    const r = await open({ variant: 'flat', opacity: 33 });
    expect(r.chips).toHaveLength(50);
    const rows = new Map<number, Box[]>();
    for (const c of r.chips) rows.set(Math.round(c.y), [...(rows.get(Math.round(c.y)) ?? []), c]);
    expect([...rows.values()].map((row) => row.length)).toEqual([10, 10, 10, 10, 10]);
    const chip = 1.25 * r.unit;
    for (const c of r.chips) {
      expect(near(c.w, chip)).toBe(true);
      expect(near(c.h, c.w)).toBe(true);
    }
    expect(near(r.chips[1].x - r.chips[0].right, 0.125 * r.unit)).toBe(true);
    expect(near(r.chips[10].y - r.chips[0].bottom, 0.125 * r.unit)).toBe(true);
    // The grid spans the picker's content box: its last column ends one padding from the edge.
    expect(near(r.picker.right - r.chips[9].right, 0.75 * r.unit)).toBe(true);
  });

  it('the custom colour spans the same width as the grid: the area at 2:1, the hue strip and the hex row under it', async () => {
    const r = await open({ variant: 'flat', opacity: 33 });
    const left = r.chips[0].x;
    const right = r.chips[9].right;
    for (const [name, b] of [['area', r.area], ['hue', r.hue], ['slider', r.slider!]] as const) {
      expect(near(b.x, left), name).toBe(true);
      expect(near(b.right, right), name).toBe(true);
    }
    expect(near(r.area.h, r.area.w / 2, 1)).toBe(true);
    expect(near(r.hue.h, r.unit)).toBe(true);
    expect(r.hue.y).toBeGreaterThan(r.area.bottom);
    expect(near(r.preview.x, left)).toBe(true);
    expect(near(r.hex.right, right)).toBe(true);
    expect(near(r.hex.h, 1.5 * r.unit)).toBe(true);
    expect(near(r.preview.h, r.hex.h)).toBe(true);
    expect(near(r.preview.w, r.preview.h)).toBe(true);
    expect(r.hex.y).toBeGreaterThan(r.hue.bottom);
  });

  it('the area\'s gradients and the rainbow are valid (an invalid image is dropped silently)', async () => {
    const r = await open({ variant: 'flat', value: '#3a7bd5' });
    expect(r.areaBackground.match(/linear-gradient\(/g)).toHaveLength(2);
    const pure = hsvToHex({ h: hexToHsv('#3a7bd5').h, s: 100, v: 100 });
    const [rr, gg, bb] = [1, 3, 5].map((i) => parseInt(pure.slice(i, i + 2), 16));
    expect(r.areaBackground).toContain(`rgb(${rr}, ${gg}, ${bb})`);
    expect(r.hueTrack).toMatch(/linear-gradient\(to right, red, yellow, lime, cyan, blue, magenta, red\)/);
  });

  it('the popover holds the picker without scrolling sideways, and nothing spills', async () => {
    const r = await open({ variant: 'flat', opacity: 33 });
    expect(r.picker.w).toBeLessThanOrEqual(r.popover.w);
    expect(await page.evaluate(() => {
      const p = document.querySelector('[data-boogy="popover"]')!;
      return p.scrollWidth <= p.clientWidth;
    })).toBe(true);
  });

  it('chips are square-cornered under a flat popover, and slightly rounded under a raised one', async () => {
    expect((await open({ variant: 'flat' })).chipRadius).toBe(0);
    const raised = await open({ variant: 'raised' });
    expect(raised.chipRadius).toBe(0.25 * raised.unit);
  });

  it('the thumb sits on the shown colour: centred at its saturation across and its brightness down', async () => {
    const r = await open({ variant: 'flat', value: '#3a7bd5' });
    const { s, v } = hexToHsv('#3a7bd5');
    expect(near(r.thumb.x + r.thumb.w / 2, r.area.x + (r.area.w * s) / 100, 1)).toBe(true);
    expect(near(r.thumb.y + r.thumb.h / 2, r.area.y + (r.area.h * (100 - v)) / 100, 1)).toBe(true);
    expect(near(r.thumb.w, r.unit)).toBe(true);
  });

  it('the hex field is not spell-checked', async () => {
    expect((await open({ variant: 'flat' })).hexSpellcheck).toBe('false');
  });
});

describe('color picker commits in a real engine', () => {
  it('a pointer drag across the area moves it live and commits once, on release', async () => {
    const r = await open({ variant: 'flat', value: '#3a7bd5' });
    await page.mouse.move(r.area.x + 10, r.area.y + 10);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) await page.mouse.move(r.area.x + 10 + i * 20, r.area.y + 10 + i * 10);
    expect((await commits()).value).toEqual([]);
    await page.mouse.up();
    await frames();
    const c = await commits();
    expect(c.value).toHaveLength(1);
    const after = await report();
    expect(after.hexValue).toBe(c.value[0]);
    expect(after.focused).toBe('area');
    // Where it was let go: the thumb's centre.
    expect(near(after.thumb.x + after.thumb.w / 2, r.area.x + 110, 1)).toBe(true);
  });

  it('a drag that leaves the area and the popover keeps tracking, held to the edge, and commits once when released outside', async () => {
    const r = await open({ variant: 'flat', value: '#3a7bd5' });
    const midY = r.area.y + r.area.h / 2;
    await page.mouse.move(r.area.x + 20, midY);
    await page.mouse.down();
    await page.mouse.move(r.area.x + r.area.w / 2, midY, { steps: 4 });
    // Out past the area's right edge, and past the popover's.
    const outside = r.popover.right + 200;
    await page.mouse.move(outside, midY, { steps: 6 });
    await frames();
    const during = await report();
    expect(during.popover).not.toBeNull(); // still open
    expect(near(during.thumb.x + during.thumb.w / 2, r.area.right, 1)).toBe(true); // held to the right edge
    expect((await commits()).value).toEqual([]);
    await page.mouse.up();
    await frames();
    const c = await commits();
    expect(c.value).toHaveLength(1);
    const { h } = hexToHsv('#3a7bd5');
    expect(c.value[0]).toBe(hsvToHex({ h, s: 100, v: 50 }));
    expect((await report()).hexValue).toBe(c.value[0]);
  });

  it('a held arrow on the area, the hue strip or the slider commits once, on release', async () => {
    await open({ variant: 'flat', value: '#3a7bd5', opacity: 33 });
    for (const slot of ['area', 'hue', 'opacity']) {
      const sel = slot === 'opacity' ? '[data-slot="opacity"] input' : `[data-slot="${slot}"]`;
      await page.focus(`[data-boogy="color-picker"] ${sel}`);
      const before = await commits();
      for (let i = 0; i < 6; i++) await page.keyboard.down('ArrowRight'); // the 2nd on are auto-repeats
      const held = await commits();
      expect(held, slot).toEqual(before);
      await page.keyboard.up('ArrowRight');
      await frames();
      const after = await commits();
      const grew = slot === 'opacity' ? after.opacity.length - before.opacity.length : after.value.length - before.value.length;
      expect(grew, slot).toBe(1);
    }
    const { opacity } = await commits();
    expect(opacity).toEqual([27]);
  });

  it('a chip coloured by a token seeds the custom colour with what the page paints', async () => {
    const r = await open({ variant: 'flat', value: 'tokened', tokened: true });
    expect(r.hexValue).toBe(oklchToHex({ l: 0.6, c: 0.15, h: 250 }));
  });
});

describe.runIf(!!SHOTS)('color picker screenshots', () => {
  it('saves the open picker, light and dark, flat and raised', async () => {
    mkdirSync(SHOTS!, { recursive: true });
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
      for (const variant of ['flat', 'raised'] as const) {
        for (const [state, value] of [['swatch', palette[25]], ['custom', '#3a7bd5']] as const) {
          await open({ variant, value, opacity: 33 });
          const pop = await page.$('[data-boogy="popover"]');
          await pop!.screenshot({ path: join(SHOTS!, `picker-${scheme}-${variant}-${state}.png`) });
        }
      }
    }
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  });
});
