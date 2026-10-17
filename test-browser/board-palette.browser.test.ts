// The board's palette as an engine computes it: it beats the foundation's own
// tokens while the page draws the board's background, and an app's own
// (unlayered) accent beats it. jsdom computes no cascade, so this runs in a
// real browser.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync, readFileSync } from 'node:fs';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';
import { boardPaletteCss } from '../src/layout/board-background';
import { boardPalette } from '../src/layout/board-palette';

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
let browser: Browser;
let page: Page;
const TEAL = '#1e3833';

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
});
afterAll(async () => { await browser?.close(); });

/** A page with the SDK foundation adopted (as installFoundation does), the
 *  board's palette in a <style> (as setBoardGround writes it), and the app's
 *  own CSS; the computed value of each token asked for. */
async function computed(appCss: string, tokens: string[], inBoard = true): Promise<Record<string, string>> {
  await page.setContent(`<!doctype html><html ${inBoard ? 'data-board-background' : ''}><head></head><body></body></html>`);
  return page.evaluate((foundation, palette, app, names) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(foundation);
    document.adoptedStyleSheets = [sheet];
    document.head.append(Object.assign(document.createElement('style'), { textContent: palette }));
    if (app) document.head.append(Object.assign(document.createElement('style'), { textContent: app }));
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n).trim()]));
  }, FOUNDATION_CSS, boardPaletteCss(TEAL), appCss, tokens);
}

describe("the board's palette in a real engine", () => {
  const p = boardPalette(TEAL);

  it("beats the foundation's own tokens while the page draws the board's background", async () => {
    const c = await computed('', ['--accent', '--ground-solid', '--board-accent', '--hue']);
    expect(c['--accent']).toBe(p['--accent']);
    expect(c['--ground-solid']).toBe(p['--ground-solid']);
    expect(c['--board-accent']).toBe(p['--board-accent']);
    expect(c['--hue']).toBe(p['--hue']);
  });

  it("an app's own unlayered accent beats the board's; --board-accent stays the board's", async () => {
    const c = await computed(':root { --accent: #ff3366; }', ['--accent', '--board-accent']);
    expect(c['--accent']).toBe('#ff3366');
    expect(c['--board-accent']).toBe(p['--board-accent']);
  });
});

/** The project template's own theme, as `boogy new` writes it. */
const TEMPLATE_THEME = readFileSync(new URL('../template/common/{{src}}/theme.css', import.meta.url), 'utf8');

describe("an app made from the project template", () => {
  const p = boardPalette(TEAL);
  it("takes the board's colours in a board: its accent, hue and tint follow the board", async () => {
    const c = await computed(TEMPLATE_THEME, ['--accent', '--hue', '--tint']);
    expect(c['--accent']).toBe(p['--accent']);
    expect(c['--hue']).toBe(p['--hue']);
    expect(c['--tint']).toBe(p['--tint']);
  });
  it('keeps its own colours outside a board', async () => {
    const c = await computed(TEMPLATE_THEME, ['--accent', '--hue'], false);
    expect(c['--accent']).toBe('oklch(0.74 0.15 170)');
    expect(c['--hue']).toBe('250');
  });
});

