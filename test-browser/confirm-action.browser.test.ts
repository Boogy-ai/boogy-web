// ConfirmAction asking, in a real layout engine: wherever it is, it never
// runs past its container. In a list row it takes a line of its own under the
// row's text, which stays readable; the row's other actions step aside.
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
  await page.setViewport({ width: 1000, height: 700 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0;font-family:var(--font-body)"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    document.adoptedStyleSheets = [sheet];
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});
afterAll(async () => { await browser?.close(); });

const asking = (question: string) => `
  <span data-boogy="confirm-action" data-asking="">
    <span data-slot="question">${question}</span>
    <span data-slot="answers">
      <button data-boogy="button" data-variant="danger" data-size="sm">Revoke</button>
      <button data-boogy="button" data-variant="quiet" data-size="sm">Cancel</button>
    </span>
  </span>`;

/** Every element inside `#box` that runs past its right edge. */
const overflowing = () => page.evaluate(() => {
  const box = document.getElementById('box')!.getBoundingClientRect();
  return [...document.querySelectorAll('#box *')]
    .filter((el) => el.getBoundingClientRect().right > box.right + 0.5)
    .map((el) => el.getAttribute('data-slot') ?? el.getAttribute('data-boogy') ?? el.tagName);
});

describe('ConfirmAction asking', () => {
  it('in a list row: under the row text, which stays readable; nothing past the panel; the other actions step aside', async () => {
    await page.evaluate((confirm) => {
      document.body.innerHTML = `
        <section id="box" data-boogy="panel" style="width:360px">
          <div data-slot="body">
            <ul data-boogy="list"><li>
              <div id="row" data-boogy="list-item">
                <span data-slot="media">L</span>
                <span id="text" data-slot="text"><span data-slot="title">general</span><span data-slot="subtitle">Expires in 14 hours · …33797c</span></span>
                <span data-slot="end"><span class="actions" style="display:flex">
                  <button id="copy" data-boogy="button" data-variant="quiet" data-shape="icon" data-size="sm" aria-label="Copy">C</button>
                  ${confirm}
                </span></span>
              </div>
            </li></ul>
          </div>
        </section>`;
    }, asking('Revoke this link? It stops working at once.'));
    expect(await overflowing()).toEqual([]);
    const r = await page.evaluate(() => {
      const text = document.getElementById('text')!.getBoundingClientRect();
      const q = document.querySelector('[data-slot="question"]')!.getBoundingClientRect();
      return { textWidth: text.width, below: q.top >= text.bottom - 0.5, copy: getComputedStyle(document.getElementById('copy')!).display };
    });
    expect(r.textWidth).toBeGreaterThan(150);
    expect(r.below).toBe(true);
    expect(r.copy).toBe('none');
  });

  it('anywhere narrow: the question wraps and the answers stay together, inside the box', async () => {
    await page.evaluate((confirm) => {
      document.body.innerHTML = `<div id="box" style="width:180px">${confirm}</div>`;
    }, asking('Remove @seed-100000? Their invites stop working for them until you allow them back.'));
    expect(await overflowing()).toEqual([]);
    const tops = await page.evaluate(() => [...document.querySelectorAll('[data-slot="answers"] > button')].map((b) => Math.round(b.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  });
});
