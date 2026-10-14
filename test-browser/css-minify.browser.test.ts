// Minifying the SDK's CSS changes nothing a browser sees: every stylesheet the
// SDK ships parses to the same rules, minified or not.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';
import { COMPONENTS_CSS } from '../src/components/components-css';
import { minifyCssLiterals, minifyCssText } from '../dev/css-minify';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** A CSS module's source run through the transform that ships, written beside
 *  it (so its own imports resolve), imported, and removed: its export, as an
 *  app's build would evaluate it. */
async function shipped(rel: string, exportName: string): Promise<string> {
  const path = join(SRC, rel);
  const tmp = join(dirname(path), `.min-${basename(path)}`);
  writeFileSync(tmp, minifyCssLiterals(readFileSync(path, 'utf8')));
  try {
    const mod = await import(/* @vite-ignore */ `${tmp}?t=${Date.now()}`);
    return mod[exportName] as string;
  } finally {
    rmSync(tmp, { force: true });
  }
}

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
let browser: Browser;
let page: Page;
beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
});
afterAll(async () => { await browser?.close(); });

/** Every rule of a stylesheet as the engine serialises it, nested rules included. */
const rules = (css: string) => page.evaluate((text) => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(text);
  const out: string[] = [];
  const walk = (list: CSSRuleList) => {
    for (const r of Array.from(list)) {
      out.push(r.cssText);
      if ('cssRules' in r && (r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules);
    }
  };
  walk(sheet.cssRules);
  return out;
}, css);

describe('the SDK CSS modules, through the transform that ships', () => {
  for (const [rel, name, original] of [
    ['layout/foundation-css.ts', 'FOUNDATION_CSS', FOUNDATION_CSS],
    ['components/components-css.ts', 'COMPONENTS_CSS', COMPONENTS_CSS],
  ] as const) {
    it(`${rel}: the same rules, smaller, no comment left`, async () => {
      const min = await shipped(rel, name);
      expect(min.length).toBeLessThan(original.length * 0.8);
      expect(min).not.toMatch(/\/\*/);
      const norm = (list: string[]) => list.map((r) => r.replace(/\s+/g, ' '));
      expect(norm(await rules(min))).toEqual(norm(await rules(original)));
    });
  }
});

describe('minified SDK CSS', () => {
  for (const [name, css] of [['foundation', FOUNDATION_CSS], ['components', COMPONENTS_CSS]] as const) {
    it(`${name}: the same rules, and smaller`, async () => {
      const min = minifyCssText(css);
      expect(min.length).toBeLessThan(css.length * 0.8);
      // Whitespace inside a value is equivalent to one space (a line break in a
      // gradient's arguments, say), so rules compare with it collapsed.
      const norm = (list: string[]) => list.map((r) => r.replace(/\s+/g, ' '));
      const [a, b] = [norm(await rules(css)), norm(await rules(min))];
      expect(a.length).toBeGreaterThan(20);
      // The innermost rules: a grouping rule's text holds its children, so the
      // first leaf that differs is the one to read.
      const leaf = (r: string) => !r.includes('{', r.indexOf('{') + 1);
      const diff = a.findIndex((r, i) => leaf(r) && r !== b[i]);
      expect(diff === -1 ? null : { original: a[diff], minified: b[diff] }).toBeNull();
      expect(b).toEqual(a);
    });
  }
});
