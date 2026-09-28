import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';

// A missing browser FAILS the suite: a skipped measurement is not a pass.
const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';

let browser: Browser;
let page: Page;

beforeAll(async () => {
  if (!existsSync(BROWSER)) {
    throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  }
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

afterAll(async () => {
  await browser?.close();
});

/** Build `<outer surface WxH><el scale-attrs/></outer>` and read el's --u in px. */
async function measure(
  box: { w: number; h: number },
  attrs: Record<string, string>,
  style: Record<string, string>,
): Promise<number> {
  return page.evaluate(
    ({ box, attrs, style }) => {
      document.body.innerHTML = '';
      const outer = document.createElement('div');
      outer.setAttribute('data-surface', 'both');
      outer.style.width = `${box.w}px`;
      outer.style.height = `${box.h}px`;
      const el = document.createElement('div');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      for (const [k, v] of Object.entries(style)) el.style.setProperty(k, v);
      outer.appendChild(el);
      document.body.appendChild(outer);
      return parseFloat(getComputedStyle(el).getPropertyValue('--u'));
    },
    { box, attrs, style },
  );
}

const wide = { w: 400, h: 200 };
const loose = { '--u-floor': '0.0625rem', '--u-cap': '10rem' }; // 1px .. 160px: never clips below

describe('axis bases (clamped, loose bounds, factor 4)', () => {
  const cases: [string, number][] = [
    ['inline', 16], // 1cqi = 4px
    ['block', 8], // 1cqb = 2px
    ['min', 8],
    ['max', 16],
    ['diagonal', 12.649], // hypot(4,2)/sqrt2 * 4
  ];
  for (const [axis, expected] of cases) {
    it(`${axis} → ${expected}px`, async () => {
      const u = await measure(wide, { 'data-u-axis': axis, 'data-u-policy': 'clamped' }, { '--u-factor': '4', ...loose });
      expect(u).toBeCloseTo(expected, 2);
    });
  }
});

describe('policies', () => {
  it('clamped stops at its cap', async () => {
    const u = await measure(wide, { 'data-u-axis': 'inline', 'data-u-policy': 'clamped' }, { '--u-factor': '10', '--u-floor': '0.25rem', '--u-cap': '1.5rem' });
    expect(u).toBeCloseTo(24, 2);
  });
  it('clamped stops at its floor', async () => {
    const u = await measure(wide, { 'data-u-axis': 'min', 'data-u-policy': 'clamped' }, { '--u-factor': '0.5', '--u-floor': '0.25rem', '--u-cap': '1.5rem' });
    expect(u).toBeCloseTo(4, 2);
  });
  it('fluid ignores the cap', async () => {
    const u = await measure(wide, { 'data-u-axis': 'inline', 'data-u-policy': 'fluid' }, { '--u-factor': '10', '--u-floor': '0.25rem', '--u-cap': '1.5rem' });
    expect(u).toBeCloseTo(40, 2);
  });
  it('fixed is the base size whatever the box', async () => {
    const u = await measure(wide, { 'data-u-axis': 'inline', 'data-u-policy': 'fixed' }, { '--u-factor': '10', ...loose });
    expect(u).toBeCloseTo(16, 2);
  });
});

describe('Review Focus', () => {
  it('diagonal on a square equals min', async () => {
    const sq = { w: 300, h: 300 };
    const d = await measure(sq, { 'data-u-axis': 'diagonal', 'data-u-policy': 'clamped' }, { '--u-factor': '4', ...loose });
    const m = await measure(sq, { 'data-u-axis': 'min', 'data-u-policy': 'clamped' }, { '--u-factor': '4', ...loose });
    expect(d).toBeCloseTo(m, 2);
  });

  it('a nested container inherits the computed --u rather than re-resolving it', async () => {
    const inner = await page.evaluate(() => {
      document.body.innerHTML = `
        <div data-surface="both" style="width:400px;height:200px">
          <div data-u-axis="inline" data-u-policy="clamped"
               style="--u-factor:4;--u-floor:0.0625rem;--u-cap:10rem">
            <div data-surface="both" style="width:100px;height:100px">
              <div id="child"></div>
            </div>
          </div>
        </div>`;
      return parseFloat(getComputedStyle(document.getElementById('child')!).getPropertyValue('--u'));
    });
    // 16px from the 400px outer box; an unregistered --u would give 4px here.
    expect(inner).toBeCloseTo(16, 2);
  });

  it('size tokens follow the LOCAL --u, on the scaled element and below it', async () => {
    // factor 2 on a 400px box: the local --u is 8px, NOT the root's 16px, so a
    // token that resolved at :root would read 16 here and fail.
    const [own, child, space] = await page.evaluate(() => {
      document.body.innerHTML = `
        <div data-surface="both" style="width:400px;height:200px">
          <div id="t" data-u-axis="inline" data-u-policy="clamped"
               style="--u-factor:2;--u-floor:0.0625rem;--u-cap:10rem;font-size:var(--fs-body)">
            <span id="c" style="font-size:var(--fs-title);padding:var(--space-4)"></span>
          </div>
        </div>`;
      const c = document.getElementById('c')!;
      return [
        parseFloat(getComputedStyle(document.getElementById('t')!).fontSize),
        parseFloat(getComputedStyle(c).fontSize),
        parseFloat(getComputedStyle(c).paddingTop),
      ];
    });
    expect(own).toBeCloseTo(8, 2);
    expect(child).toBeCloseTo(10, 2); // --fs-title = 1.25 * 8
    expect(space).toBeCloseTo(8, 2); // --space-4 = 1 * 8
  });

  it('status colours are valid in both schemes', async () => {
    const res = await page.evaluate(() => {
      const out: string[][] = [];
      for (const scheme of ['light', 'dark']) {
        document.documentElement.style.setProperty('--scheme', scheme);
        document.body.innerHTML = ['ok', 'warn', 'danger', 'info'].map((k) => `<i id="${k}" style="color:var(--${k})"></i>`).join('');
        out.push(['ok', 'warn', 'danger', 'info'].map((k) => getComputedStyle(document.getElementById(k)!).color));
      }
      document.documentElement.style.removeProperty('--scheme');
      return out;
    });
    for (const scheme of res) for (const c of scheme) expect(c).not.toBe('rgb(0, 0, 0)');
    expect(res[0]).not.toEqual(res[1]);
  });
});

describe('theme', () => {
  it('light-dark() switches the ground with the scheme knob', async () => {
    const [light, dark] = await page.evaluate(() => {
      document.body.innerHTML = '<div id="g" style="background:var(--ground)"></div>';
      const g = document.getElementById('g')!;
      document.documentElement.style.setProperty('--scheme', 'light');
      const l = getComputedStyle(g).backgroundColor;
      document.documentElement.style.setProperty('--scheme', 'dark');
      const d = getComputedStyle(g).backgroundColor;
      return [l, d];
    });
    expect(light).not.toBe('');
    expect(light).not.toBe(dark);
  });

  it('relative colour syntax derives a hover accent distinct from the accent', async () => {
    const [a, h] = await page.evaluate(() => {
      document.body.innerHTML = '<i id="a" style="color:var(--accent)"></i><i id="h" style="color:var(--accent-hover)"></i>';
      return [getComputedStyle(document.getElementById('a')!).color, getComputedStyle(document.getElementById('h')!).color];
    });
    expect(h).not.toBe('');
    expect(h).not.toBe(a);
    expect(h).not.toBe('rgb(0, 0, 0)'); // an invalid value falls back to the inherited black
  });
});

describe('overrides', () => {
  it("an app's own unlayered rule beats the foundation, though the foundation sheet comes later", async () => {
    const [before, after] = await page.evaluate(() => {
      document.body.innerHTML = '<div id="g" style="background:var(--ground)"></div>';
      const g = document.getElementById('g')!;
      document.documentElement.style.removeProperty('--scheme');
      const style = document.createElement('style');
      style.textContent = ':root { --scheme: dark; --hue: 30; --tint: 0.1; }';
      const b = getComputedStyle(g).backgroundColor;
      document.head.appendChild(style); // a document sheet: ordered BEFORE the adopted foundation sheet
      const a = getComputedStyle(g).backgroundColor;
      style.remove();
      return [b, a];
    });
    expect(after).not.toBe(before);
    expect(after).toContain('30'); // the app's hue reached the derived ground
  });
});

describe('the size scale', () => {
  it('every size token is a step of the LOCAL --u', async () => {
    // A region whose --u is 8px: each token must read as its multiple of 8.
    const got = await page.evaluate(() => {
      document.body.innerHTML = `
        <div data-surface="both" style="width:400px;height:200px">
          <div id="t" data-u-axis="inline" data-u-policy="clamped"
               style="--u-factor:2;--u-floor:0.0625rem;--u-cap:10rem"></div>
        </div>`;
      const el = document.getElementById('t')!;
      const probe = document.createElement('i');
      el.appendChild(probe);
      const read = (token: string) => { probe.style.width = `var(${token})`; return parseFloat(getComputedStyle(probe).width); };
      return Object.fromEntries([
        '--space-0', '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-8',
        '--control-sm', '--control-md', '--control-lg', '--icon-sm', '--icon-md', '--mark-md', '--mark-lg',
        '--radius-1', '--radius-2', '--radius-3', '--ring',
      ].map((t) => [t, read(t)]));
    });
    expect(got).toEqual({
      '--space-0': 1, '--space-1': 2, '--space-2': 4, '--space-3': 6, '--space-4': 8, '--space-5': 12, '--space-6': 16, '--space-8': 24,
      '--control-sm': 12, '--control-md': 16, '--control-lg': 20, '--icon-sm': 8, '--icon-md': 10, '--mark-md': 14, '--mark-lg': 18,
      '--radius-1': 2, '--radius-2': 4, '--radius-3': 8, '--ring': 1,
    });
  });

  it('the touch minimum is fixed, not scaled', async () => {
    const w = await page.evaluate(() => {
      document.body.innerHTML = '<div data-surface="both" style="width:400px;height:200px"><i id="p" data-u-axis="inline" data-u-policy="clamped" style="--u-factor:2;--u-floor:0.0625rem;--u-cap:10rem;display:block;width:var(--touch-min)"></i></div>';
      return parseFloat(getComputedStyle(document.getElementById('p')!).width);
    });
    expect(w).toBe(44);
  });
});
