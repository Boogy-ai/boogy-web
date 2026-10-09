import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';
import { COMPONENTS_CSS } from '../src/components/components-css';

const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
let browser: Browser;
let page: Page;

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setContent('<!doctype html><html><head></head><body style="margin:0;padding:40px"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [sheet];
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});

afterAll(async () => {
  await browser?.close();
});

async function mount(html: string): Promise<void> {
  await page.evaluate((h) => { document.body.innerHTML = h; }, html);
}
const style = (sel: string, prop: string) =>
  page.$eval(sel, (el, p) => getComputedStyle(el).getPropertyValue(p as string), prop);

const GROUP = (disabled: string) => `
  <fieldset data-boogy="choice-group" ${disabled}><legend>L</legend>
    <div id="c" data-slot="choice"><input id="r" type="radio" name="n" ${disabled}>
      <label id="t" for="r" data-slot="choice-label">A</label><span id="d" data-slot="choice-description">About A</span></div>
  </fieldset>`;

describe('choice group cursor', () => {
  it('an enabled choice shows the pointer on its radio, label and description', async () => {
    await mount(GROUP(''));
    for (const sel of ['#t', '#r', '#d']) expect(await style(sel, 'cursor')).toBe('pointer');
  });
  it('a disabled group keeps no pointer anywhere in a choice', async () => {
    await mount(GROUP('disabled'));
    for (const sel of ['#c', '#t', '#d', '#r']) expect(await style(sel, 'cursor')).not.toBe('pointer');
  });
});

// Firefox cannot emulate a media feature over WebDriver BiDi, so the reduced
// motion case is run by making the query always true: the same rules, matched.
async function useCss(css: string): Promise<void> {
  await page.evaluate((c) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(c);
    document.adoptedStyleSheets = [sheet];
  }, css);
}

describe('switch thumb motion', () => {
  const SWITCH = '<button id="s" data-boogy="switch" role="switch" aria-checked="false"><span id="tr" data-slot="track"><span id="th" data-slot="thumb"></span></span><span data-slot="label">x</span></button>';
  const ALL = FOUNDATION_CSS + COMPONENTS_CSS;
  it('slides on a short transition by default', async () => {
    await useCss(ALL);
    await mount(SWITCH);
    expect(await style('#th', 'transition-duration')).not.toBe('0s');
  });
  it('jumps, with no transition, when the person asks for reduced motion', async () => {
    await useCss(ALL.replaceAll('(prefers-reduced-motion: reduce)', 'all'));
    await mount(SWITCH);
    expect(await style('#th', 'transition-duration')).toBe('0s');
    expect(await style('#tr', 'transition-duration')).toBe('0s');
    await useCss(ALL);
  });
});
