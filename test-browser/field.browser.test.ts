// A multi-line field in a real layout: however short its text, it shows at
// least its rows, at either size (a content-sized field would shrink to one
// line, and the large size's taller control must not undo the rows).
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
  await page.setViewport({ width: 1200, height: 800 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0;padding:40px"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    document.adoptedStyleSheets = [sheet];
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});

afterAll(async () => {
  await browser?.close();
});

/** A TextArea's markup with `rows`, at `size`: its height, and its line height. */
function areaIn(size: 'md' | 'lg', rows: number) {
  return page.evaluate((size, rows) => {
    document.body.innerHTML = `<div data-boogy="field" ${size === 'lg' ? 'data-size="lg"' : ''} style="width:400px">
      <label data-slot="label" for="a">Names</label>
      <textarea id="a" data-slot="control" rows="${rows}" style="--field-rows:${rows}"></textarea>
    </div>`;
    const area = document.getElementById('a') as HTMLTextAreaElement;
    const lh = Number.parseFloat(getComputedStyle(area).lineHeight) || Number.parseFloat(getComputedStyle(area).fontSize) * 1.2;
    return { height: area.getBoundingClientRect().height, lh };
  }, size, rows);
}

describe('a multi-line field in a real layout', () => {
  for (const size of ['md', 'lg'] as const) {
    it(`${size}: empty, it still shows its 4 rows`, async () => {
      const r = await areaIn(size, 4);
      expect(r.height).toBeGreaterThanOrEqual(r.lh * 4);
    });
  }
});

/** A composer's markup (a textarea and a send button in a field group), as
 *  `variant`, holding `text`: the textarea's and the button's boxes, and one
 *  control's height. */
function composerWith(variant: 'framed' | 'bar', text: string) {
  return page.evaluate((variant, text) => {
    document.body.innerHTML = `<form data-boogy="field" ${variant === 'bar' ? 'data-variant="bar"' : ''} style="width:400px">
      <div data-slot="group">
        <textarea id="t" data-slot="control" rows="1" placeholder="Message carol"></textarea>
        <span data-slot="suffix"><button data-boogy="button" data-variant="solid" data-shape="icon" data-size="sm" data-rounded="true">↑</button></span>
      </div>
    </form>`;
    const area = document.getElementById('t') as HTMLTextAreaElement;
    area.value = text;
    const button = document.querySelector('button')!;
    const box = (e: Element) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, mid: r.top + r.height / 2, height: r.height }; };
    const probe = document.createElement('div');
    probe.style.height = 'var(--control-md)';
    document.body.append(probe);
    const control = probe.getBoundingClientRect().height;
    return { area: box(area), button: box(button), control };
  }, variant, text);
}

describe('a composer: its text and its send button line up', () => {
  for (const variant of ['framed', 'bar'] as const) {
    it(`${variant}: one line is one control tall, centred on the send button`, async () => {
      const { area, button, control } = await composerWith(variant, '');
      expect(Math.abs(area.height - control)).toBeLessThanOrEqual(1);
      expect(Math.abs(area.mid - button.mid)).toBeLessThanOrEqual(1);
    });
    it(`${variant}: eight lines show whole before it scrolls`, async () => {
      await composerWith(variant, 'one\ntwo\nthree\nfour\nfive\nsix\nseven\neight');
      const fits = await page.evaluate(() => {
        const t = document.getElementById('t') as HTMLTextAreaElement;
        return t.scrollHeight - t.clientHeight;
      });
      expect(fits).toBeLessThanOrEqual(1);
    });
    it(`${variant}: as the text grows, the send button stays by its last line`, async () => {
      const { area, button, control } = await composerWith(variant, 'one\ntwo\nthree');
      expect(area.height).toBeGreaterThan(1.5 * control);
      expect(Math.abs(button.mid - (area.bottom - control / 2))).toBeLessThanOrEqual(1);
    });
  }
});
