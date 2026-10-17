// Markdown in a real browser: marked and DOMPurify as the host serves them,
// through the SDK's renderer. GFM renders; nothing a writer puts in runs or
// restyles the page; links and images go out with nothing of the reader's.
// Then the preview's layout: headings set apart, a wide table scrolling
// inside a bubble.
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
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL('./fixtures/markdown.fixture.ts', import.meta.url)), formats: ['iife'], name: 'MarkdownFixtureBundle' },
    },
  });
  const result = Array.isArray(out) ? out[0] : out;
  return (result as { output: { type: string; code?: string }[] }).output.find((o) => o.type === 'chunk')!.code!;
}

type Fixture = { markdownFixture: { render(md: string): string; supported: boolean } };
const render = (md: string) => page.evaluate((md) => (window as unknown as Fixture).markdownFixture.render(md), md);

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  const code = await bundle();
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 900, height: 900 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0;font-family:var(--font-body)"></body></html>');
  await page.evaluate((css, code) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    document.adoptedStyleSheets = [sheet];
    (0, eval)(code);
  }, FOUNDATION_CSS + COMPONENTS_CSS, code);
}, 60_000);
afterAll(async () => { await browser?.close(); });

describe('markdown, rendered and sanitised', () => {
  it('DOMPurify can work here', async () => {
    expect(await page.evaluate(() => (window as unknown as Fixture).markdownFixture.supported)).toBe(true);
  });

  it('GFM: headings, emphasis, lists, task lists, tables, strikethrough, line breaks', async () => {
    const r = await page.evaluate((html) => {
      const d = document.createElement('div');
      d.innerHTML = html;
      const box = d.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      return {
        h1: d.querySelector('h1')?.textContent, strong: d.querySelector('strong')?.textContent, items: d.querySelectorAll('li').length,
        checked: box?.checked, disabled: box?.disabled, cells: d.querySelectorAll('td').length, del: d.querySelector('del')?.textContent,
        br: !!d.querySelector('p br'), lang: d.querySelector('pre > code')?.className,
      };
    }, await render('# Title\n\nSome **bold**.\n\n- a\n- [x] done\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n~~gone~~\n\nline one\nline two\n\n```py\nprint(1)\n```'));
    expect(r).toEqual({ h1: 'Title', strong: 'bold', items: 2, checked: true, disabled: true, cells: 2, del: 'gone', br: true, lang: 'language-py' });
  });

  it('nothing a writer puts in runs or restyles the page', async () => {
    const attacks = [
      '<script>alert(1)</script>',
      '<img src="x" onerror="alert(2)">',
      '[click](javascript:alert(3))',
      '[click](JaVaScRiPt:alert(3))',
      '<a href="https://example.com" onclick="alert(4)">e</a>',
      '<iframe src="https://example.com"></iframe>',
      '<object data="https://example.com"></object>',
      '<form action="https://example.com"><input name="p"><button>go</button></form>',
      '<style>body { display: none }</style>',
      '<p style="position: fixed; inset: 0">cover</p>',
      '<svg><script>alert(5)</script></svg>',
      '<math><mi xlink:href="javascript:alert(6)">x</mi></math>',
      '<a href="data:text/html,<script>alert(7)</script>">d</a>',
      '<details open ontoggle="alert(8)">x</details>',
    ];
    for (const attack of attacks) {
      const r = await page.evaluate((html) => {
        const d = document.createElement('div');
        d.innerHTML = html;
        const hrefs = [...d.querySelectorAll('[href], [xlink\\:href]')].map((e) => e.getAttribute('href') ?? e.getAttribute('xlink:href') ?? '');
        return {
          html,
          banned: !!d.querySelector('script, iframe, object, embed, form, style, [style]'),
          handlers: [...d.querySelectorAll('*')].some((e) => [...e.attributes].some((a) => a.name.startsWith('on'))),
          badHref: hrefs.some((h) => /^\s*(javascript|data|vbscript):/i.test(h)),
        };
      }, await render(attack));
      expect(r.banned, `${attack} → ${r.html}`).toBe(false);
      expect(r.handlers, `${attack} → ${r.html}`).toBe(false);
      expect(r.badHref, `${attack} → ${r.html}`).toBe(false);
    }
  });

  it('only what GFM makes survives: no fake UI, no media, no ids, no data attributes, no borrowed classes', async () => {
    const attacks = [
      '<input placeholder="Password"><button>Sign in</button><textarea>x</textarea><select><option>a</option></select><label>l</label>',
      '<dialog open>covering</dialog><details open><summary>s</summary>d</details><div popover>p</div>',
      '<video autoplay src="https://example.com/v.mp4" poster="https://example.com/p.png"></video><audio src="https://example.com/a.mp3"></audio>',
      '<img src="https://example.com/i.png" srcset="https://example.com/i2.png 2x"><input type="image" src="https://example.com/b.png">',
      '<img src="https://example.com/m.png" usemap="#m"><map name="m"><area href="https://example.com" target="_top"></map>',
      '<div data-boogy="notice" data-slot="x" data-inactive>fake notice</div><span data-boogy="button">fake button</span>',
      '<a id="location" name="cookie" href="https://example.com">clobber</a><img name="body" src="x">',
      '<span class="row-actions">app styles</span><code class="language-py evil">c</code><p class="hljs">x</p>',
      '<a href="https://example.com" target="_top">top</a>',
      '- [ ] task',
    ];
    for (const attack of attacks) {
      const r = await page.evaluate((html) => {
        const tags = new Set(['P', 'BR', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'EM', 'DEL', 'CODE', 'PRE', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'A', 'IMG', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'INPUT']);
        const attrs: Record<string, string[]> = {
          A: ['href', 'title', 'target', 'rel'], IMG: ['src', 'alt', 'title', 'loading', 'referrerpolicy'], INPUT: ['type', 'checked', 'disabled'],
          OL: ['start'], TH: ['align'], TD: ['align'], CODE: ['class'],
        };
        const d = document.createElement('div');
        d.innerHTML = html;
        const bad: string[] = [];
        for (const el of d.querySelectorAll('*')) {
          if (!tags.has(el.tagName)) bad.push(`tag ${el.tagName}`);
          for (const a of el.attributes) if (!(attrs[el.tagName] ?? []).includes(a.name)) bad.push(`${el.tagName}[${a.name}]`);
          if (el.tagName === 'CODE' && el.hasAttribute('class') && !/^language-[\w+#.-]+$/.test(el.getAttribute('class')!)) bad.push('code class');
          if (el.tagName === 'INPUT' && (el.getAttribute('type') !== 'checkbox' || !el.hasAttribute('disabled'))) bad.push('input not a disabled checkbox');
          if (el.tagName === 'A' && el.hasAttribute('href') && (el.getAttribute('target') !== '_blank' || el.getAttribute('rel') !== 'noopener noreferrer')) bad.push('link not apart');
        }
        return { html, bad };
      }, await render(attack));
      expect(r.bad, `${attack} → ${r.html}`).toEqual([]);
    }
  });

  it('a link opens apart with nothing sent back; an image sends no referrer', async () => {
    const r = await page.evaluate((html) => {
      const d = document.createElement('div');
      d.innerHTML = html;
      const a = d.querySelector('a')!;
      const img = d.querySelector('img')!;
      return [a.getAttribute('target'), a.getAttribute('rel'), img.getAttribute('referrerpolicy'), img.getAttribute('loading')];
    }, await render('[site](https://example.com) ![pic](https://example.com/p.png)'));
    expect(r).toEqual(['_blank', 'noopener noreferrer', 'no-referrer', 'lazy']);
  });
});

describe('a preview, laid out', () => {
  it('headings stand above the text; a wide table scrolls inside, never past its bubble', async () => {
    const html = await render(`# Big\n\ntext\n\n| ${Array.from({ length: 30 }, (_, i) => `col ${i}`).join(' | ')} |\n|${'---|'.repeat(30)}\n| ${Array.from({ length: 30 }, (_, i) => `v${i}`).join(' | ')} |`);
    const r = await page.evaluate((html) => {
      document.body.innerHTML = `
        <div style="width:600px;display:flex;flex-direction:column">
          <div id="BB" data-boogy="bubble"><div data-slot="body"><div id="M" data-boogy="markdown">${html}</div></div></div>
        </div>`;
      const m = document.getElementById('M')!;
      const table = m.querySelector('table')!;
      const body = document.querySelector('#BB > [data-slot="body"]')!.getBoundingClientRect();
      return {
        h1: parseFloat(getComputedStyle(m.querySelector('h1')!).fontSize), p: parseFloat(getComputedStyle(m.querySelector('p')!).fontSize),
        tableScrolls: table.scrollWidth > table.clientWidth,
        inside: m.getBoundingClientRect().right <= body.right + 0.5,
        pageWide: document.documentElement.scrollWidth > innerWidth,
      };
    }, html);
    expect(r.h1).toBeGreaterThan(r.p);
    expect(r.tableScrolls).toBe(true);
    expect(r.inside).toBe(true);
    expect(r.pageWide).toBe(false);
  });
});
