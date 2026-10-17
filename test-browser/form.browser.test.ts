// A Form in a real browser: in a short column its fields scroll and its foot
// stays at the bottom, never scrolling in or out of view; its actions line up
// with the fields, Delete first and Save last.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';
import { COMPONENTS_CSS } from '../src/components/components-css';

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
      lib: { entry: fileURLToPath(new URL('./fixtures/form.fixture.tsx', import.meta.url)), formats: ['iife'], name: 'FormFixtureBundle' },
    },
  });
  const result = Array.isArray(out) ? out[0] : out;
  return (result as { output: { type: string; code?: string }[] }).output.find((o) => o.type === 'chunk')!.code!;
}

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  const code = await bundle();
  browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.evaluate((css, code) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    document.adoptedStyleSheets = [sheet];
    (0, eval)(code);
  }, FOUNDATION_CSS + COMPONENTS_CSS, code);
  await page.evaluate(() => (window as unknown as { formFixture: { mount(w: number, h: number): void } }).formFixture.mount(1000, 420));
}, 60_000);
afterAll(async () => { await browser?.close(); });

const geometry = () => page.evaluate(() => {
  const root = document.getElementById('R')!.getBoundingClientRect();
  const body = document.querySelector<HTMLElement>('[data-boogy="form"] > [data-slot="body"]')!;
  const foot = document.querySelector('[data-boogy="form"] > [data-slot="foot"]')!.getBoundingClientRect();
  const fields = document.querySelector('[data-boogy="form"] [data-slot="fields"]')!.getBoundingClientRect();
  const at = (kind: string) => document.querySelector(`[data-action="${kind}"]`)!.getBoundingClientRect();
  return {
    scrolls: body.scrollHeight > body.clientHeight,
    footBottom: Math.round(foot.bottom - root.bottom),
    footTop: Math.round(foot.top),
    saveRight: Math.round(at('save').right),
    fieldsRight: Math.round(fields.right),
    order: ['delete', 'cancel', 'save'].map((k) => Math.round(at(k).left)),
    scrollTop: body.scrollTop,
  };
});

describe('a Form in a short column', () => {
  it('its fields scroll; its foot stays at the bottom, before and after they do', async () => {
    const before = await geometry();
    expect(before.scrolls).toBe(true);
    expect(before.footBottom).toBe(0);
    await page.evaluate(() => { const b = document.querySelector<HTMLElement>('[data-boogy="form"] > [data-slot="body"]')!; b.scrollTop = b.scrollHeight; });
    const after = await geometry();
    expect(after.scrollTop).toBeGreaterThan(0);
    expect(after.footBottom).toBe(0);
    expect(after.footTop).toBe(before.footTop);
  });

  it('its actions line up with its fields: Delete first, Save at the fields\' edge', async () => {
    const g = await geometry();
    expect(g.saveRight).toBe(g.fieldsRight);
    const [del, cancel, save] = g.order;
    expect(del).toBeLessThan(cancel);
    expect(cancel).toBeLessThan(save);
  });

  it('a padded image keeps its thumbnail\'s size, inset from its edges, in a wide form as a narrow one', async () => {
    const sizes = [];
    for (const width of [1000, 400]) {
      sizes.push(await page.evaluate(async (width) => {
        document.getElementById('R')!.style.width = `${width}px`;
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        const thumb = document.querySelector('[data-boogy="thumbnail"]')!;
        const img = thumb.querySelector('img')!.getBoundingClientRect();
        const box = thumb.getBoundingClientRect();
        const probe = document.createElement('div');
        probe.style.width = 'var(--thumb-lg)';
        document.body.appendChild(probe);
        const lg = probe.getBoundingClientRect().width;
        probe.remove();
        return { box: Math.round(box.width), lg: Math.round(lg), inset: Math.round(img.left - box.left) };
      }, width));
    }
    for (const s of sizes) {
      expect(s.box).toBe(s.lg);
      expect(s.inset).toBeGreaterThan(0);
      expect(s.inset).toBeLessThan(s.box / 4);
    }
  });
});
