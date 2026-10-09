// FitText and FillGrid measured in a real layout engine. The unit tests run the
// algorithms on numbers, and happy-dom lays nothing out, so this is the only
// place their reads of a laid-out box (scroll and client sizes, the computed
// padding and gap, a resolved length) and the cell CSS meet.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';
import { FOUNDATION_CSS } from '../src/layout/foundation-css';
import { COMPONENTS_CSS } from '../src/components/components-css';

// A missing browser FAILS the suite: a skipped measurement is not a pass.
const BROWSER = process.env.BOOGY_TEST_BROWSER ?? '/usr/bin/chromium';
let browser: Browser;
let page: Page;

/** The three measuring modules, and the zoom store FitText follows, as one
 *  classic script that publishes what the tests call on `window.measuring`. */
function measuringScript(): string {
  const body = ['layout/zoom', 'components/measure', 'components/fit-text', 'components/fill-grid']
    .map((name) => {
      const source = readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8');
      const { outputText } = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      });
      // Every import in these modules is one line and names only another of
      // the four, whose code shares this script's scope once concatenated.
      // Dropping the import lines and the `export` keywords leaves one
      // self-contained script.
      return outputText.replace(/^import .*$/gm, '').replace(/^export /gm, '');
    })
    .join('\n');
  return `(() => {\n${body}\nwindow.measuring = { attachFitText, attachFillGrid, flushRounds, setFrameScheduler, setHostZoom, clearHostZoom, resolveLength, measurePadding, measureContentBox };\n})();`;
}

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  browser = BROWSER.includes('firefox')
    ? await puppeteer.launch({ browser: 'firefox', executablePath: BROWSER, headless: true })
    : await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    document.adoptedStyleSheets = [sheet];
    document.documentElement.style.fontSize = '16px';
  }, FOUNDATION_CSS + COMPONENTS_CSS);
  await page.evaluate(measuringScript());
});

afterAll(async () => {
  await browser?.close();
});

type Handle = { refit(): void; detach(): void };
type Measuring = {
  attachFitText(el: HTMLElement, opts?: { group?: string }): Handle;
  attachFillGrid(el: HTMLElement, count: () => number, opts: { aspect: number; minInline: string; minBlock: string }): Handle;
  flushRounds(): void;
  setFrameScheduler(next: (run: () => void) => void): (run: () => void) => void;
  setHostZoom(factor: number): void;
  clearHostZoom(): void;
  resolveLength(host: HTMLElement, length: string): number;
  measurePadding(el: Element): { inline: number; block: number };
  measureContentBox(el: Element): { inline: number; block: number };
};

/** Fit `text` in a `w`×`h` px `tag` with bounds `min`..`max`. Reports the
 *  factor kept, the font size it gives, whether the text fits there, and
 *  whether it still fits one bisection step (1/128) higher. */
function fitIn(text: string, w: number, h: number, min: string, max: string, tag = 'div') {
  return page.evaluate((text, w, h, min, max, tag) => {
    const m = (window as unknown as { measuring: Measuring }).measuring;
    document.body.replaceChildren();
    const el = document.createElement(tag);
    el.setAttribute('data-boogy', 'fit-text');
    el.style.cssText = `width:${w}px;height:${h}px;line-height:1.2;--fit-min:${min};--fit-max:${max}`;
    el.textContent = text;
    document.body.append(el);
    const restore = m.setFrameScheduler(() => {});
    const handle = m.attachFitText(el);
    m.flushRounds();
    m.setFrameScheduler(restore);
    const overflows = () => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
    const fit = Number(el.style.getPropertyValue('--fit'));
    const size = Number.parseFloat(getComputedStyle(el).fontSize);
    const fitsAtFit = !overflows();
    el.style.setProperty('--fit', String(fit + 1 / 128));
    const fitsAbove = !overflows();
    handle.detach();
    return { fit, size, fitsAtFit, fitsAbove };
  }, text, w, h, min, max, tag);
}

/** Lay `n` children out in a FillGrid whose content box is `w`×`h` px, with
 *  `extra` CSS on the grid. Reports the published shape and every child's
 *  rendered size. */
function gridIn(n: number, w: number, h: number, gap: string, extra = '') {
  return page.evaluate((n, w, h, gap, extra) => {
    const m = (window as unknown as { measuring: Measuring }).measuring;
    document.body.replaceChildren();
    const el = document.createElement('div');
    el.setAttribute('data-boogy', 'fill-grid');
    el.style.cssText = `box-sizing:content-box;width:${w}px;height:${h}px;--fill-gap:${gap};--fill-min-block:2.75rem;${extra}`;
    for (let i = 0; i < n; i++) el.append(document.createElement('div'));
    document.body.append(el);
    const restore = m.setFrameScheduler(() => {});
    const handle = m.attachFillGrid(el, () => el.children.length, { aspect: 1.6, minInline: '7rem', minBlock: '2.75rem' });
    m.flushRounds();
    m.setFrameScheduler(restore);
    const cells = [...el.children].map((c) => {
      const r = c.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    const out = {
      cols: el.style.getPropertyValue('--cols'),
      rows: el.style.getPropertyValue('--rows'),
      fallback: el.dataset.fallback,
      cells,
      clientWidth: el.clientWidth,
      scrolls: el.scrollHeight > el.clientHeight,
    };
    handle.detach();
    return out;
  }, n, w, h, gap, extra);
}

const QUESTION = 'Which of these should the team pick for the long weekend in the mountains next spring?';

describe('FitText in a real layout', () => {
  it('keeps the largest size that fits: it fits there, and one step larger overflows', async () => {
    const r = await fitIn(QUESTION, 320, 120, '8px', '200px');
    expect(r.fit).toBeGreaterThan(0);
    expect(r.fit).toBeLessThan(1);
    expect(r.size).toBeGreaterThan(8);
    expect(r.size).toBeLessThan(200);
    expect(r.fitsAtFit).toBe(true);
    expect(r.fitsAbove).toBe(false);
  });

  it('keeps the maximum when the text fits at it', async () => {
    const r = await fitIn('Yes', 320, 120, '8px', '60px');
    expect(r.fit).toBe(1);
    expect(r.size).toBe(60);
    expect(r.fitsAtFit).toBe(true);
  });

  it('fits a span like any other tag: the element is a box whatever its tag', async () => {
    const r = await fitIn(QUESTION, 320, 120, '8px', '200px', 'span');
    expect(r.fit).toBeLessThan(1);
    expect(r.fitsAtFit).toBe(true);
    expect(r.fitsAbove).toBe(false);
  });
});

describe('FitText never breaks a word to fit', () => {
  /** Fit `text` in a `w`×`h` px box and report, per word, how many lines it
   *  is drawn across; the box's computed overflow-wrap; its overflow mark;
   *  and whether it spills sideways. */
  function wordsIn(text: string, w: number, h: number, min: string, max: string) {
    return page.evaluate((text, w, h, min, max) => {
      const m = (window as unknown as { measuring: Measuring }).measuring;
      document.body.replaceChildren();
      const el = document.createElement('div');
      el.setAttribute('data-boogy', 'fit-text');
      el.style.cssText = `width:${w}px;height:${h}px;line-height:1.2;overflow:hidden;--fit-min:${min};--fit-max:${max}`;
      el.textContent = text;
      document.body.append(el);
      const restore = m.setFrameScheduler(() => {});
      const handle = m.attachFitText(el);
      m.flushRounds();
      m.setFrameScheduler(restore);
      const node = el.firstChild as Text;
      const lines: Record<string, number> = {};
      let at = 0;
      for (const word of text.split(' ')) {
        const start = text.indexOf(word, at);
        at = start + word.length;
        const r = document.createRange();
        r.setStart(node, start);
        r.setEnd(node, at);
        lines[word] = new Set([...r.getClientRects()].filter((b) => b.width > 0).map((b) => Math.round(b.top))).size;
      }
      const out = {
        lines,
        wrap: getComputedStyle(el).overflowWrap,
        overflow: el.dataset.overflow,
        spills: el.scrollWidth > el.clientWidth + 1,
        size: Number.parseFloat(getComputedStyle(el).fontSize),
      };
      handle.detach();
      return out;
    }, text, w, h, min, max);
  }

  it('a word wider than the box counts as not fitting: the size shrinks until every word is whole on one line', async () => {
    // A tall, narrow tile: at a large size "Chocolate" breaks across two
    // lines and the broken word still fits the box's height.
    const r = await wordsIn('Chocolate', 150, 300, '8px', '150px');
    expect(r.lines).toEqual({ Chocolate: 1 });
    expect(r.overflow).toBe('false');
    expect(r.wrap).toBe('normal');
  });

  it('several words: each is whole, wrapped only between words', async () => {
    const r = await wordsIn('Chocolate cake with sprinkles', 160, 320, '8px', '150px');
    expect(Object.values(r.lines).every((n) => n === 1)).toBe(true);
    expect(r.spills).toBe(false);
  });

  it('a word too wide even at the minimum breaks there rather than spilling out of its box', async () => {
    const r = await wordsIn('Supercalifragilisticexpialidocious', 60, 200, '16px', '32px');
    expect(r.overflow).toBe('true');
    expect(r.size).toBe(16);
    expect(r.wrap).toBe('anywhere');
    expect(r.spills).toBe(false);
  });
});

describe('Stat in a real layout', () => {
  /** A Stat's value of `text` in a `w` px wide stat, fitted in 8..120 px.
   *  Reports the size kept, the value's height, and whether it still fits
   *  one bisection step (1/128) larger. */
  function statIn(text: string, w: number) {
    return page.evaluate((text, w) => {
      const m = (window as unknown as { measuring: Measuring }).measuring;
      document.body.replaceChildren();
      const st = document.createElement('div');
      st.setAttribute('data-boogy', 'stat');
      st.style.width = `${w}px`;
      const value = document.createElement('p');
      value.setAttribute('data-boogy', 'fit-text');
      value.setAttribute('data-slot', 'value');
      value.style.cssText = '--fit-min:8px;--fit-max:120px';
      value.textContent = text;
      st.append(value);
      document.body.append(st);
      const restore = m.setFrameScheduler(() => {});
      const h = m.attachFitText(value);
      m.flushRounds();
      m.setFrameScheduler(restore);
      const overflows = () => value.scrollHeight > value.clientHeight + 1 || value.scrollWidth > value.clientWidth + 1;
      const size = Number.parseFloat(getComputedStyle(value).fontSize);
      const height = value.getBoundingClientRect().height;
      const fit = Number(value.style.getPropertyValue('--fit'));
      value.style.setProperty('--fit', String(fit + 1 / 128));
      const fitsAbove = !overflows();
      h.detach();
      return { size, height, fitsAbove };
    }, text, w);
  }

  it('a short value in a wide stat is set at its maximum: its glyphs never read as overflow', async () => {
    const r = await statIn('12', 600);
    expect(r.size).toBe(120);
  });

  it("a long value shrinks to its stat's width on one line, the largest that fits, rather than wrapping at the maximum", async () => {
    const r = await statIn('12,345', 120);
    expect(r.size).toBeLessThan(120);
    // One line of the font's own height is under 1.5 em; two would be over 2.
    expect(r.height).toBeLessThan(r.size * 1.5);
    expect(r.fitsAbove).toBe(false);
  });
});

describe('FitText groups and overflow in a real layout', () => {
  it('a group is fitted at one size: every member fits there, and one step larger the longest overflows', async () => {
    const r = await page.evaluate(() => {
      const m = (window as unknown as { measuring: Measuring }).measuring;
      document.body.replaceChildren();
      const make = (text: string) => {
        const el = document.createElement('div');
        el.setAttribute('data-boogy', 'fit-text');
        el.style.cssText = 'width:300px;height:60px;line-height:1.2;--fit-min:8px;--fit-max:120px';
        el.textContent = text;
        document.body.append(el);
        return el;
      };
      const els = [make('Yes'), make('Bulk import from spreadsheets')];
      const restore = m.setFrameScheduler(() => {});
      const handles = els.map((el) => m.attachFitText(el, { group: 'labels' }));
      m.flushRounds();
      m.setFrameScheduler(restore);
      const overflows = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      const sizes = els.map((el) => getComputedStyle(el).fontSize);
      const fitsAll = els.every((el) => !overflows(el));
      const fit = Number(els[1].style.getPropertyValue('--fit'));
      els[1].style.setProperty('--fit', String(fit + 1 / 128));
      const longestAbove = !overflows(els[1]);
      handles.forEach((h) => h.detach());
      return { sizes, fitsAll, fit, longestAbove };
    });
    expect(r.sizes[0]).toBe(r.sizes[1]);
    expect(r.fit).toBeGreaterThan(0);
    expect(r.fit).toBeLessThan(1);
    expect(r.fitsAll).toBe(true);
    expect(r.longestAbove).toBe(false);
  });

  it('a text that overflows even at its minimum says so, with the whole lines its box shows', async () => {
    const r = await page.evaluate(() => {
      const m = (window as unknown as { measuring: Measuring }).measuring;
      document.body.replaceChildren();
      const el = document.createElement('div');
      el.setAttribute('data-boogy', 'fit-text');
      el.style.cssText = 'width:200px;height:50px;overflow:hidden;line-height:20px;--fit-min:16px;--fit-max:32px';
      el.textContent = 'A long label that cannot fit in two lines of this narrow box at any size we allow';
      document.body.append(el);
      const restore = m.setFrameScheduler(() => {});
      const h = m.attachFitText(el);
      m.flushRounds();
      m.setFrameScheduler(restore);
      const out = { overflow: el.dataset.overflow, lines: el.style.getPropertyValue('--fit-lines'), fit: el.style.getPropertyValue('--fit') };
      h.detach();
      return out;
    });
    expect(r).toEqual({ overflow: 'true', lines: '2', fit: '0' });
  });
});

describe('FillGrid in a real layout', () => {
  it('a wide box: 3 children in one row, each a third of the width less the gaps, full height', async () => {
    const r = await gridIn(3, 1552, 638, '14px');
    expect([r.cols, r.rows, r.fallback]).toEqual(['3', '1', 'false']);
    for (const c of r.cells) {
      expect(c.w).toBeCloseTo((1552 - 2 * 14) / 3, 0);
      expect(c.h).toBeCloseTo(638, 0);
    }
  });

  it('a tall box: 12 children in 2 × 6, each cell the box less the gaps', async () => {
    const r = await gridIn(12, 336, 420, '8px');
    expect([r.cols, r.rows, r.fallback]).toEqual(['2', '6', 'false']);
    for (const c of r.cells) {
      expect(c.w).toBeCloseTo((336 - 8) / 2, 0);
      expect(c.h).toBeCloseTo((420 - 5 * 8) / 6, 0);
    }
  });

  it('below the minimum cell: one scrolling column of full-width cells at the minimum height', async () => {
    const r = await gridIn(12, 200, 300, '8px');
    expect([r.cols, r.rows, r.fallback]).toEqual(['1', '12', 'true']);
    expect(r.scrolls).toBe(true);
    for (const c of r.cells) {
      expect(c.w).toBeCloseTo(r.clientWidth, 0);
      expect(c.h).toBeCloseTo(44, 0);
    }
  });

  it('chooses its shape from its content box: padding and a border around it change nothing', async () => {
    // Measured outside the padding and border, this box would be 956 × 440 and
    // take 2 × 2; its content box, where the cells are laid out, is 336 × 420.
    const r = await gridIn(3, 336, 420, '8px', 'padding:0 300px;border:10px solid');
    expect([r.cols, r.rows, r.fallback]).toEqual(['1', '3', 'false']);
    for (const c of r.cells) {
      expect(c.w).toBeCloseTo(336, 0);
      expect(c.h).toBeCloseTo((420 - 2 * 8) / 3, 0);
    }
  });

  it('measures its box to the fraction of a pixel: no cell is narrower than the minimum, however the box rounds', async () => {
    // Three across, each cell would be (351.7 - 2 × 8) / 3 = 111.9 px, under
    // the 7rem (112 px) minimum. Read in whole pixels, the box is 352 wide and
    // the cell 112. Two across, in two rows, every cell meets the minimum.
    const r = await gridIn(3, 351.7, 100, '8px');
    expect([r.cols, r.rows, r.fallback]).toEqual(['2', '2', 'false']);
    for (const c of r.cells) expect(c.w).toBeGreaterThanOrEqual(112);
  });

  it('chooses its shape from its untransformed box: a scale on it changes nothing', async () => {
    // Scaled to a quarter, the box would draw at 84 × 105, under the minimum
    // cell; the cells are still laid out in 336 × 420.
    const r = await gridIn(12, 336, 420, '8px', 'transform:scale(0.25);transform-origin:0 0');
    expect([r.cols, r.rows, r.fallback]).toEqual(['2', '6', 'false']);
    for (const c of r.cells) {
      expect(c.w).toBeCloseTo(((336 - 8) / 2) * 0.25, 0);
      expect(c.h).toBeCloseTo(((420 - 5 * 8) / 6) * 0.25, 0);
    }
  });
});

describe('resolveLength', () => {
  it('a percentage on a host that is not laid out resolves to 0, not to its number read as pixels', async () => {
    const r = await page.evaluate(() => {
      const m = (window as unknown as { measuring: Measuring }).measuring;
      document.body.replaceChildren();
      const host = document.createElement('div');
      host.style.cssText = 'display:none;position:relative;width:400px';
      document.body.append(host);
      const out = { percent: m.resolveLength(host, '50%'), mixed: m.resolveLength(host, 'calc(50% + 2rem)'), rem: m.resolveLength(host, '2rem') };
      host.remove();
      return out;
    });
    // A length that needs no box still resolves.
    expect(r).toEqual({ percent: 0, mixed: 0, rem: 32 });
  });
});

describe('measurePadding and measureContentBox', () => {
  /** An element's padding and content box, in its own writing mode. */
  function axesIn(writingMode: string) {
    return page.evaluate((writingMode) => {
      const m = (window as unknown as { measuring: Measuring }).measuring;
      const el = document.createElement('div');
      el.style.cssText = `writing-mode:${writingMode};width:200px;height:120px;padding:1px 2px 3px 4px`;
      document.body.replaceChildren(el);
      const out = { padding: m.measurePadding(el), box: m.measureContentBox(el) };
      el.remove();
      return out;
    }, writingMode);
  }

  it('in horizontal text, inline runs across the page', async () => {
    expect(await axesIn('horizontal-tb')).toEqual({ padding: { inline: 6, block: 4 }, box: { inline: 200, block: 120 } });
  });

  it('in vertical text, inline runs down the page', async () => {
    expect(await axesIn('vertical-rl')).toEqual({ padding: { inline: 4, block: 6 }, box: { inline: 120, block: 200 } });
    expect(await axesIn('vertical-lr')).toEqual({ padding: { inline: 4, block: 6 }, box: { inline: 120, block: 200 } });
  });
});

describe('FillGrid gaps in container units', () => {
  // The gap a grid lays out with and the gap its cells subtract from their
  // share of the row must be one length: cells sized from a gap a fraction of
  // a pixel larger than the grid's own fill the row, and the last one wraps.
  // A zoom moves a size container's padding and so its content box, which
  // container units resolve against, without resizing the container itself.
  it('a zoom that moves its container keeps every row whole: the cells and the grid agree on the gap', async () => {
    const r = await page.evaluate(async () => {
      const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
      document.body.replaceChildren();
      const box = document.createElement('div');
      // A scale region (fluid, on its shorter side), as a full-screen stage is:
      // its unit, and so its padding, follow the zoom.
      box.setAttribute('data-u-axis', 'min');
      box.setAttribute('data-u-policy', 'fluid');
      // Its rows: a heading, the grid in the rest, a footer.
      box.style.cssText = 'container-type:size;box-sizing:border-box;width:1060px;height:738px;--u-factor:1.6;--u-floor:0.875rem;' +
        'padding:max(var(--space-4), 1.6cqmin);display:grid;grid-template-rows:auto minmax(0, 1fr) auto;gap:max(var(--space-3), 1.2cqmin);font-size:var(--fs-body)';
      const heading = document.createElement('h1');
      heading.style.cssText = 'margin:0;font-size:calc(max(1.125rem, 3.5cqmin) * var(--u-zoom))';
      heading.textContent = 'A heading';
      const grid = document.createElement('div');
      grid.setAttribute('data-boogy', 'fill-grid');
      grid.style.cssText = '--cols:2;--rows:1;--fill-gap:max(0.5rem, 1.6cqmin)';
      for (let i = 0; i < 2; i++) {
        // Each cell a size container, its text in units of the zoom.
        const cell = document.createElement('div');
        cell.style.cssText = 'container-type:size;font-size:calc(max(1rem, 18cqmin) * var(--u-zoom))';
        cell.textContent = 'x';
        grid.append(cell);
      }
      const footer = document.createElement('p');
      footer.style.margin = '0';
      footer.textContent = 'A footer';
      box.append(heading, grid, footer);
      document.body.append(box);
      const rows = () => new Set([...grid.children].map((c) => Math.round(c.getBoundingClientRect().top))).size;
      await frame();
      const before = rows();
      const seen: number[] = [];
      for (const z of ['1.1', '1.25', '1.5', '1.75', '2', '1.5', '1']) {
        // As the zoom store draws a zoom: the factor, and the attribute.
        document.documentElement.style.setProperty('--u-zoom', z);
        document.documentElement.setAttribute('data-zoom', '');
        await frame();
        await frame();
        seen.push(rows());
      }
      document.documentElement.style.removeProperty('--u-zoom');
      document.documentElement.removeAttribute('data-zoom');
      return { before, seen };
    });
    expect(r.before).toBe(1);
    expect(r.seen).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });
});

describe('FitText inside FillGrid cells, fitted in one batch', () => {
  it("each label is fitted to its cell's final size, not to the whole box the cell fills before the grid's shape is set", async () => {
    const r = await page.evaluate(() => {
      const m = (window as unknown as { measuring: Measuring }).measuring;
      document.body.replaceChildren();
      const text = 'Long weekend in the mountains';
      const label = (w: string, h: string) => {
        const el = document.createElement('div');
        el.setAttribute('data-boogy', 'fit-text');
        el.style.cssText = `width:${w};height:${h};line-height:1.2;--fit-min:8px;--fit-max:150px`;
        el.textContent = text;
        return el;
      };
      const overflows = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      // The hazard, measured: at the maximum, the text fits the grid's whole
      // box (each cell's size until the grid publishes its shape) but not a
      // third of it (each cell's size after).
      const whole = label('1552px', '638px');
      const third = label(`${(1552 - 28) / 3}px`, '638px');
      document.body.append(whole, third);
      const hazard = { fitsWhole: !overflows(whole), fitsThird: !overflows(third) };
      document.body.replaceChildren();

      const grid = document.createElement('div');
      grid.setAttribute('data-boogy', 'fill-grid');
      grid.style.cssText = 'width:1552px;height:638px;--fill-gap:14px;--fill-min-block:2.75rem';
      const labels = [0, 1, 2].map(() => label('100%', '100%'));
      for (const l of labels) {
        const cell = document.createElement('div');
        cell.append(l);
        grid.append(cell);
      }
      document.body.append(grid);
      const restore = m.setFrameScheduler(() => {});
      // Labels first, as a framework runs a child's effects before its parent's.
      const handles = labels.map((l) => m.attachFitText(l));
      handles.push(m.attachFillGrid(grid, () => grid.children.length, { aspect: 1.6, minInline: '7rem', minBlock: '2.75rem' }));
      m.flushRounds();
      m.setFrameScheduler(restore);
      const results = labels.map((l) => {
        const fit = Number(l.style.getPropertyValue('--fit'));
        const fitsAtFit = !overflows(l);
        l.style.setProperty('--fit', String(fit + 1 / 128));
        const fitsAbove = !overflows(l);
        return { fit, fitsAtFit, fitsAbove };
      });
      for (const h of handles) h.detach();
      return { hazard, cols: grid.style.getPropertyValue('--cols'), results };
    });
    expect(r.hazard).toEqual({ fitsWhole: true, fitsThird: false });
    expect(r.cols).toBe('3');
    for (const x of r.results) {
      expect(x.fit).toBeLessThan(1);
      expect(x.fitsAtFit).toBe(true);
      expect(x.fitsAbove).toBe(false);
    }
  });
});

describe('FitText in FillGrid cells, when only the number of children changes', () => {
  // A new child reshapes the grid while the grid's box keeps its size: the
  // texts already in its cells are queued by nothing but the grid's result.
  it('the texts already in the cells are fitted to their new cells in the same batch, not a frame later', async () => {
    const r = await page.evaluate(() => {
      const m = (window as unknown as { measuring: Measuring }).measuring;
      document.body.replaceChildren();
      const overflows = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      const grid = document.createElement('div');
      grid.setAttribute('data-boogy', 'fill-grid');
      grid.style.cssText = 'width:900px;height:300px;--fill-gap:14px;--fill-min-block:2.75rem';
      document.body.append(grid);
      const labels: HTMLElement[] = [];
      const handles: Handle[] = [];
      const addCell = () => {
        const cell = document.createElement('div');
        const l = document.createElement('div');
        l.setAttribute('data-boogy', 'fit-text');
        l.style.cssText = 'width:100%;height:100%;line-height:1.2;--fit-min:8px;--fit-max:150px';
        l.textContent = 'Long weekend in the mountains';
        cell.append(l);
        grid.append(cell);
        labels.push(l);
        handles.push(m.attachFitText(l));
      };
      const restore = m.setFrameScheduler(() => {});
      addCell();
      addCell();
      const gridHandle = m.attachFillGrid(grid, () => grid.children.length, { aspect: 1.6, minInline: '7rem', minBlock: '2.75rem' });
      m.flushRounds();
      const before = grid.style.getPropertyValue('--cols');
      // One more child, and the grid told its count changed: one batch.
      addCell();
      gridHandle.refit();
      m.flushRounds();
      m.setFrameScheduler(restore);
      const after = grid.style.getPropertyValue('--cols');
      const results = labels.map((l) => {
        const fit = Number(l.style.getPropertyValue('--fit'));
        const fitsAtFit = !overflows(l);
        l.style.setProperty('--fit', String(fit + 1 / 128));
        const fitsAbove = !overflows(l);
        l.style.setProperty('--fit', String(fit));
        return { fitsAtFit, fitsAbove };
      });
      [...handles, gridHandle].forEach((h) => h.detach());
      return { before, after, results };
    });
    expect([r.before, r.after]).toEqual(['2', '3']);
    for (const x of r.results) expect(x).toEqual({ fitsAtFit: true, fitsAbove: false });
  });
});

describe('texts fitted in one batch whose boxes depend on each other', () => {
  // A fitted heading above a row of tiles, each tile a size container whose
  // label is sized in its container units: every size the heading tries moves
  // the tiles, and with them the label's bounds. Swept over stage heights, as
  // where the two land relative to each other depends on the pixels.
  it("a label is fitted to the tile the heading's final size leaves it: it overflows only at its minimum, and one step larger overflows", async () => {
    const r = await page.evaluate((question) => {
      const m = (window as unknown as { measuring: Measuring }).measuring;
      const texts = [
        'Arrives in the early hours of the morning and leaves well before the sun is up.',
        'Comes out in daylight to shine, and rests out of sight for the whole of the night.',
      ];
      const overflows = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      const out: { h: number; fit: number; over: number; aboveFits: boolean }[] = [];
      for (let h = 560; h <= 800; h += 8) {
        document.body.replaceChildren();
        const stage = document.createElement('div');
        stage.style.cssText = `width:1212px;height:${h}px;display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px;container-type:size`;
        const q = document.createElement('h1');
        q.setAttribute('data-boogy', 'fit-text');
        q.style.cssText = 'margin:0;line-height:1.04;max-block-size:40cqb;overflow:hidden;--fit-min:18px;--fit-max:40cqb';
        q.textContent = question;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:12px;min-height:0';
        const labels = texts.map((text) => {
          const tile = document.createElement('div');
          tile.style.cssText = 'flex:1;min-width:0;container-type:size;padding:12px';
          const l = document.createElement('div');
          l.setAttribute('data-boogy', 'fit-text');
          l.style.cssText = 'height:100%;overflow:hidden;line-height:1.2;--fit-min:max(14px, 7cqmin);--fit-max:max(16px, 22cqmin)';
          l.textContent = text;
          tile.append(l);
          row.append(tile);
          return l;
        });
        stage.append(q, row);
        document.body.append(stage);
        const restore = m.setFrameScheduler(() => {});
        const handles = [m.attachFitText(q), ...labels.map((l) => m.attachFitText(l, { group: 'tiles' }))];
        // Every frame's batch, run by hand until nothing is queued.
        for (let frame = 0; frame < 8; frame++) m.flushRounds();
        m.setFrameScheduler(restore);
        const fit = Number(labels[0].style.getPropertyValue('--fit'));
        const over = labels.filter(overflows).length;
        labels.forEach((l) => l.style.setProperty('--fit', String(fit + 1 / 128)));
        const aboveFits = fit < 1 && labels.every((l) => !overflows(l));
        out.push({ h, fit, over, aboveFits });
        handles.forEach((hd) => hd.detach());
      }
      return out;
    }, QUESTION);
    expect(r.length).toBeGreaterThan(20);
    expect(r.filter((x) => x.over > 0 && x.fit > 0)).toEqual([]);
    expect(r.filter((x) => x.aboveFits)).toEqual([]);
  });
});

describe('re-fitting on a zoom', () => {
  // Bounds written in the zoom: a zoom moves them while the box keeps its
  // size, so no resize ever says to fit again.
  it('FitText fits again when the zoom changes: still fitting its unchanged box, at a size the zoom moved', async () => {
    const r = await page.evaluate(async () => {
      const m = (window as unknown as { measuring: Measuring }).measuring;
      const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
      const settle = async () => { for (let n = 0; n < 12; n++) await frame(); };
      m.flushRounds();
      document.body.replaceChildren();
      const el = document.createElement('div');
      el.setAttribute('data-boogy', 'fit-text');
      el.style.cssText = 'width:300px;height:120px;line-height:1.2;overflow:hidden;' +
        '--fit-min:calc(0.75rem * var(--u-zoom));--fit-max:calc(4rem * var(--u-zoom))';
      el.textContent = 'Where should the team meet on Friday?';
      document.body.append(el);
      const fits = () => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1;
      const px = () => Number.parseFloat(getComputedStyle(el).fontSize);
      const handle = m.attachFitText(el);
      await settle();
      const at1 = { px: px(), fits: fits() };
      m.setHostZoom(2);
      await settle();
      const at2 = { px: px(), fits: fits() };
      m.setHostZoom(0.5);
      await settle();
      const atHalf = { px: px(), fits: fits() };
      m.clearHostZoom();
      handle.detach();
      return { at1, at2, atHalf };
    });
    // Larger: still fits its box (fitted again, not left overflowing).
    expect(r.at1.fits).toBe(true);
    expect(r.at2.fits).toBe(true);
    // Half: its maximum is now 2rem, below the size it fitted at, so smaller.
    expect(r.atHalf.fits).toBe(true);
    expect(r.atHalf.px).toBeLessThan(r.at1.px);
  });
});

describe('re-fitting when a web font arrives', () => {
  // A page's text first lays out in a fallback face and swaps to its web font
  // when that loads (font-display: swap). The swap changes the text's size
  // without resizing its box, so no resize says to fit again. Fitted in the
  // fallback, a text would keep that size: too small, or (a display face set
  // tight) stuck at its minimum as "overflowing".
  it('FitText fits again once a font finishes loading: the largest size that fits in the face it now shows', async () => {
    const font = readFileSync(new URL('../fonts/figtree-latin-wght-5.3.0.woff2', import.meta.url)).toString('base64');
    const r = await page.evaluate(async (text, font) => {
      const m = (window as unknown as { measuring: Measuring }).measuring;
      const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
      const settle = async () => { for (let n = 0; n < 12; n++) await frame(); };
      m.flushRounds();
      document.body.replaceChildren();
      const el = document.createElement('div');
      el.setAttribute('data-boogy', 'fit-text');
      // A face not loaded yet: the text lays out in the monospace fallback.
      el.style.cssText = "width:320px;height:120px;line-height:1.2;font-family:'Late Face', monospace;--fit-min:8px;--fit-max:200px";
      el.textContent = text;
      document.body.append(el);
      const overflows = () => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      const handle = m.attachFitText(el);
      await settle();
      const before = Number(el.style.getPropertyValue('--fit'));
      const face = new FontFace('Late Face', `url(data:font/woff2;base64,${font})`);
      document.fonts.add(face);
      await face.load();
      await settle();
      const after = Number(el.style.getPropertyValue('--fit'));
      const fitsAfter = !overflows();
      el.style.setProperty('--fit', String(after + 1 / 128));
      const fitsAbove = !overflows();
      el.style.setProperty('--fit', String(after));
      handle.detach();
      document.fonts.delete(face);
      return { before, after, fitsAfter, fitsAbove };
    }, QUESTION, font);
    expect(r.after).not.toBe(r.before);
    expect(r.fitsAfter).toBe(true);
    expect(r.fitsAbove).toBe(false);
  });
});

describe('re-fitting on resize, through the shared observer', () => {
  // Runs on the real frame scheduler: a resize reaches the job through the
  // ResizeObserver, and the batch runs on the next animation frame.
  it('FitText re-fits when its box shrinks, and after detach a resize changes nothing', async () => {
    const r = await page.evaluate(async (text) => {
      const m = (window as unknown as { measuring: Measuring }).measuring;
      const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
      const until = async (ok: () => boolean) => {
        for (let n = 1; n <= 60; n++) { await frame(); if (ok()) return n; }
        return -1;
      };
      m.flushRounds();
      document.body.replaceChildren();
      const el = document.createElement('div');
      el.setAttribute('data-boogy', 'fit-text');
      el.style.cssText = 'width:320px;height:120px;line-height:1.2;--fit-min:8px;--fit-max:200px';
      el.textContent = text;
      document.body.append(el);
      const fitNow = () => el.style.getPropertyValue('--fit');
      const handle = m.attachFitText(el);
      const first = await until(() => fitNow() !== '');
      const wide = fitNow();
      el.style.width = '160px';
      const refit = await until(() => fitNow() !== wide);
      const narrow = fitNow();
      const fitsNarrow = !(el.scrollHeight > el.clientHeight + 1);
      handle.detach();
      el.style.width = '320px';
      for (let n = 0; n < 3 * Math.max(first, refit) + 5; n++) await frame();
      return { first, refit, wide: Number(wide), narrow: Number(narrow), fitsNarrow, afterDetach: Number(fitNow()) };
    }, QUESTION);
    expect(r.first).toBeGreaterThan(0);
    expect(r.refit).toBeGreaterThan(0);
    expect(r.narrow).toBeLessThan(r.wide);
    expect(r.fitsNarrow).toBe(true);
    expect(r.afterDetach).toBe(r.narrow);
  });

  it('FillGrid takes a new shape when its box changes, and after detach a resize changes nothing', async () => {
    const r = await page.evaluate(async () => {
      const m = (window as unknown as { measuring: Measuring }).measuring;
      const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
      const until = async (ok: () => boolean) => {
        for (let n = 1; n <= 60; n++) { await frame(); if (ok()) return n; }
        return -1;
      };
      m.flushRounds();
      document.body.replaceChildren();
      const el = document.createElement('div');
      el.setAttribute('data-boogy', 'fill-grid');
      el.style.cssText = 'width:1552px;height:638px;--fill-gap:14px;--fill-min-block:2.75rem';
      for (let i = 0; i < 3; i++) el.append(document.createElement('div'));
      document.body.append(el);
      const shape = () => `${el.style.getPropertyValue('--cols')} × ${el.style.getPropertyValue('--rows')}`;
      const handle = m.attachFillGrid(el, () => el.children.length, { aspect: 1.6, minInline: '7rem', minBlock: '2.75rem' });
      const first = await until(() => shape() === '3 × 1');
      el.style.width = '336px';
      el.style.height = '420px';
      const reshaped = await until(() => shape() === '1 × 3');
      handle.detach();
      el.style.width = '1552px';
      el.style.height = '638px';
      for (let n = 0; n < 3 * Math.max(first, reshaped) + 5; n++) await frame();
      return { first, reshaped, afterDetach: shape() };
    });
    expect(r.first).toBeGreaterThan(0);
    expect(r.reshaped).toBeGreaterThan(0);
    expect(r.afterDetach).toBe('1 × 3');
  });
});
