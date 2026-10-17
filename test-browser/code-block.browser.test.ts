// CodeBlock in a real layout engine: collapsed to its first lines, scrolling
// sideways inside itself only, inside a bubble without passing its edge, its
// colours told apart.
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
  await page.setViewport({ width: 900, height: 900 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0;font-family:var(--font-body)"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    document.adoptedStyleSheets = [sheet];
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});
afterAll(async () => { await browser?.close(); });

const block = (lines: string[], collapsed?: number) => `
  <figure id="B" data-boogy="code-block" ${collapsed ? `data-collapsed="true" style="--code-lines:${collapsed}"` : ''}>
    <figcaption data-slot="head"><span data-slot="language">Python</span><button data-boogy="button" data-size="sm" data-variant="quiet">Copy</button></figcaption>
    <pre id="P" data-slot="code"><code class="hljs">${lines.join('\n')}</code></pre>
    ${collapsed ? '<div data-slot="foot"><button data-boogy="button" data-size="sm" data-variant="quiet">Show all</button></div>' : ''}
  </figure>`;

describe('CodeBlock', () => {
  it('collapsed: exactly its first lines tall; open: every line', async () => {
    const lines = Array.from({ length: 25 }, (_, i) => `x${i} = ${i}`);
    await page.evaluate((html) => { document.body.innerHTML = `<div style="width:500px">${html}</div>`; }, block(lines, 10));
    const r = await page.evaluate(() => {
      const pre = document.getElementById('P')!;
      const cs = getComputedStyle(pre);
      const lh = parseFloat(cs.lineHeight);
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const collapsed = pre.getBoundingClientRect().height;
      document.getElementById('B')!.removeAttribute('data-collapsed');
      return { lines: (collapsed - pad) / lh, open: (pre.getBoundingClientRect().height - pad) / lh };
    });
    expect(r.lines).toBeCloseTo(10, 1);
    expect(r.open).toBeCloseTo(25, 1);
  });

  it('a long line scrolls inside the code, never the page; inside a bubble it stops at the bubble', async () => {
    const long = `print("${'a very long line of code '.repeat(20)}")`;
    await page.evaluate((html) => {
      document.body.innerHTML = `
        <div id="T" style="width:600px;display:flex;flex-direction:column">
          <div id="BB" data-boogy="bubble"><div data-slot="body">Look:${html}</div></div>
        </div>`;
    }, block([long, 'x = 1']));
    const r = await page.evaluate(() => {
      const pre = document.getElementById('P')!;
      const body = document.querySelector('#BB > [data-slot="body"]')!.getBoundingClientRect();
      const b = document.getElementById('B')!.getBoundingClientRect();
      return {
        scrolls: pre.scrollWidth > pre.clientWidth,
        pageWide: document.documentElement.scrollWidth > innerWidth,
        inside: b.right <= body.right + 0.5,
        bubbleMax: document.getElementById('BB')!.getBoundingClientRect().width <= 0.8 * 600 + 0.5,
      };
    });
    expect(r.scrolls).toBe(true);
    expect(r.pageWide).toBe(false);
    expect(r.inside).toBe(true);
    expect(r.bubbleMax).toBe(true);
  });

  it('on a grey accent (a grey board) the colours are still colours, each its own', async () => {
    await page.evaluate((html) => { document.body.innerHTML = `<div style="--accent: oklch(0.8 0 0)">${html}</div>`; },
      block(['<span id="k" class="hljs-keyword">def</span> <span id="s" class="hljs-string">"s"</span> <span id="n" class="hljs-number">1</span> <span id="t" class="hljs-title">f</span>']));
    const chroma = await page.evaluate(() => ['k', 's', 'n', 't'].map((id) => {
      // The colour as the browser resolved it, read back in oklch.
      const probe = document.createElement('canvas').getContext('2d')!;
      probe.fillStyle = getComputedStyle(document.getElementById(id)!).color;
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
      return Math.max(r, g, b) - Math.min(r, g, b);
    }));
    for (const c of chroma) expect(c).toBeGreaterThan(20);
    const colours = await page.evaluate(() => ['k', 's', 'n', 't'].map((id) => getComputedStyle(document.getElementById(id)!).color));
    expect(new Set(colours).size).toBe(4);
  });

  it('a language name too long to fit is cut short, and Copy stays in the block', async () => {
    const html = block(['x']).replace('<span data-slot="language">Python</span>', `<span data-slot="language">${'z'.repeat(300)}</span>`);
    await page.evaluate((html) => { document.body.innerHTML = `<div style="width:360px">${html}</div>`; }, html);
    const r = await page.evaluate(() => {
      const b = document.getElementById('B')!.getBoundingClientRect();
      const copy = document.querySelector('#B [data-slot="head"] button')!.getBoundingClientRect();
      return { copyInside: copy.right <= b.right + 0.5 && copy.width > 20, pageWide: document.documentElement.scrollWidth > innerWidth };
    });
    expect(r.copyInside).toBe(true);
    expect(r.pageWide).toBe(false);
  });

  it('a view not shown takes no height but keeps the block as wide as it needs', async () => {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div style="width:700px;display:flex;flex-direction:column;align-items:flex-start">
          <figure id="MB" data-boogy="code-block">
            <figcaption data-slot="head"><span data-slot="language">Md</span></figcaption>
            <div id="PV" data-slot="preview"><p style="margin:0">short</p></div>
            <pre id="SV" data-slot="code" data-inactive aria-hidden="true"><code># a much longer line of markdown source than the preview</code></pre>
          </figure>
        </div>`;
    });
    const measure = () => page.evaluate(() => ({
      width: document.getElementById('MB')!.getBoundingClientRect().width,
      hiddenHeight: document.querySelector('#MB > [data-inactive]')!.getBoundingClientRect().height,
    }));
    const preview = await measure();
    await page.evaluate(() => {
      document.getElementById('SV')!.removeAttribute('data-inactive');
      document.getElementById('PV')!.setAttribute('data-inactive', '');
    });
    const source = await measure();
    expect(preview.width).toBeCloseTo(source.width, 0);
    expect(preview.hiddenHeight).toBe(0);
    expect(source.hiddenHeight).toBe(0);
  });

  it('a keyword, a string and a comment are three colours, none the plain ink', async () => {
    await page.evaluate((html) => { document.body.innerHTML = html; },
      block(['<span id="k" class="hljs-keyword">def</span> f(): <span id="s" class="hljs-string">"s"</span> <span id="c" class="hljs-comment"># c</span>']));
    const c = await page.evaluate(() => ['k', 's', 'c', 'P'].map((id) => getComputedStyle(document.getElementById(id)!).color));
    const [k, s, comment, ink] = c;
    expect(new Set([k, s, comment, ink]).size).toBe(4);
  });
});
