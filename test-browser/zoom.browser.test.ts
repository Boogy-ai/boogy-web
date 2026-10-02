import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';
import { scale } from '../src/layout/scale';

// A missing browser FAILS the suite: a skipped measurement is not a pass.
const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
let browser: Browser;
let page: Page;

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [sheet];
    document.documentElement.style.fontSize = '16px';
  }, FOUNDATION_CSS);
});
afterAll(async () => { await browser?.close(); });

/** At `zoom`: the root's --u, a scaled region's --u (in a w×h surface), and a
 *  `--icon-md` box's and a token-sized image's rendered sizes, in px. */
async function at(zoom: number, box: { w: number; h: number }) {
  const s = scale();
  return page.evaluate(
    (zoom, box, attrs, style) => {
      const root = document.documentElement;
      root.style.setProperty('--u-zoom', String(zoom));
      const outer = document.createElement('div');
      outer.setAttribute('data-surface', 'both');
      outer.style.width = `${box.w}px`;
      outer.style.height = `${box.h}px`;
      const region = document.createElement('div');
      for (const [k, v] of Object.entries(attrs)) region.setAttribute(k, v);
      for (const [k, v] of Object.entries(style)) region.style.setProperty(k, v);
      outer.append(region);
      const icon = document.createElement('div');
      icon.style.cssText = 'width: var(--icon-md); height: var(--icon-md)';
      // A 2:1 image sized by a token: it must grow without changing shape.
      const img = document.createElement('img');
      img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"/>');
      img.style.cssText = 'display:block; width: var(--thumb-md); height: auto';
      document.body.append(outer, icon, img);
      return new Promise<{ root: number; region: number; icon: number; imgW: number; imgH: number }>((resolve) => {
        const read = () => {
          const r = img.getBoundingClientRect();
          const out = {
            root: parseFloat(getComputedStyle(root).getPropertyValue('--u')),
            region: parseFloat(getComputedStyle(region).getPropertyValue('--u')),
            icon: icon.getBoundingClientRect().width,
            imgW: r.width,
            imgH: r.height,
          };
          outer.remove(); icon.remove(); img.remove();
          resolve(out);
        };
        if (img.complete) read(); else img.onload = read;
      });
    },
    zoom, box, { 'data-u-axis': s['data-u-axis'], 'data-u-policy': s['data-u-policy'] }, s.style,
  );
}

describe('interface zoom (real browser: Chromium by default; BOOGY_TEST_BROWSER=/usr/bin/firefox)', () => {
  it('scales the root unit, a token box and an image by exactly the zoom; the image keeps its shape', async () => {
    const one = await at(1, { w: 300, h: 300 });
    const more = await at(1.5, { w: 300, h: 300 });
    expect(one.root).toBe(16);
    expect(more.root).toBe(24);
    expect(more.icon).toBeCloseTo(one.icon * 1.5, 3);
    expect(more.imgW).toBeCloseTo(one.imgW * 1.5, 3);
    expect(one.imgW / one.imgH).toBeCloseTo(2, 3);
    expect(more.imgW / more.imgH).toBeCloseTo(2, 3);
  });

  it('zooms a scaled region PAST its cap: the multiplier is outside the clamp', async () => {
    // 1000px square, axis min, factor 4 → 40px, clamped to the default cap (17px).
    const one = await at(1, { w: 1000, h: 1000 });
    const more = await at(1.5, { w: 1000, h: 1000 });
    expect(one.region).toBe(17);
    expect(more.region).toBe(25.5);
  });
});

describe('a page that sizes its root font from the SDK (as an app shell does)', () => {
  // `html { font: var(--fs-body)/1.5 … }`: the root's font-size comes from
  // the unit. If the root's unit were derived from `rem`, that is a
  // dependency cycle — Firefox (per spec) then drops the token, and the font
  // shorthand with it. The root default must not depend on the root's font.
  async function shell(zoom: number) {
    const p = await browser.newPage();
    await p.setContent('<!doctype html><html><head></head><body style="margin:0">x</body></html>');
    const out = await p.evaluate((css, zoom) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css + '\nhtml, body { font: var(--fs-body)/1.5 monospace; }');
      document.adoptedStyleSheets = [sheet];
      if (zoom !== 1) document.documentElement.style.setProperty('--u-zoom', String(zoom));
      const root = getComputedStyle(document.documentElement);
      return {
        u: parseFloat(root.getPropertyValue('--u')),
        fsBody: root.getPropertyValue('--fs-body').trim(),
        fontSize: parseFloat(getComputedStyle(document.body).fontSize),
        family: getComputedStyle(document.body).fontFamily,
      };
    }, FOUNDATION_CSS, zoom);
    await p.close();
    return out;
  }

  it('keeps its token and font at zoom 1, and zooms at 1.25', async () => {
    const one = await shell(1);
    expect(one.fsBody, 'the --fs-body token resolves').not.toBe('');
    expect(one.family).toContain('monospace');
    expect(one.u).toBe(16);
    expect(one.fontSize).toBe(16);
    const more = await shell(1.25);
    expect(more.u).toBe(20);
    expect(more.fontSize).toBe(20);
  });
});
