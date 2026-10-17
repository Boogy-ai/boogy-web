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
  await page.setViewport({ width: 1400, height: 900 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    const still = new CSSStyleSheet();
    still.replaceSync('*, *::before, *::after { transition: none !important; }');
    document.adoptedStyleSheets = [sheet, still];
  }, FOUNDATION_CSS + COMPONENTS_CSS);
});

afterAll(async () => {
  await browser?.close();
});

/** A layout of `width` px with the drawer's state as attributes. --u is 16px. */
async function layout(width: number, attrs: Record<string, string>): Promise<void> {
  await page.evaluate(({ width, attrs }) => {
    const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    document.body.innerHTML = `
      <div id="L" data-boogy="drawer-layout" data-collapse-at="md" ${a} style="width:${width}px;height:600px">
        <nav id="D" data-boogy="drawer">
          <a id="T" data-boogy="drawer-item" data-variant="title" href="#"><span id="tmark" data-slot="mark">B</span><span id="tlbl" data-slot="label">Boards</span></a>
          <a id="I" data-boogy="drawer-item" data-variant="entry" href="#"><span id="imark" data-slot="mark">SC</span><span id="lbl" data-slot="label">Scratchpad</span></a>
        </nav>
        <div id="B" data-boogy="drawer-backdrop"></div>
        <main id="M" data-boogy="drawer-main">main</main>
      </div>`;
  }, { width, attrs });
}
const rect = (id: string) => page.$eval(id, (el) => { const r = el.getBoundingClientRect(); return { x: r.x, w: r.width, h: r.height }; });
const css = (id: string, p: string) => page.$eval(id, (el, p) => getComputedStyle(el).getPropertyValue(p as string).trim(), p);

describe('docked (container at or above the breakpoint, md = 48rem)', () => {
  it('reports its mode to script', async () => {
    await layout(1000, { 'data-expanded': 'true' });
    expect(await css('#D', '--boogy-drawer-mode')).toBe('docked');
  });

  it('expanded: a 15-unit column beside the main area', async () => {
    await layout(1000, { 'data-expanded': 'true' });
    expect((await rect('#D')).w).toBeCloseTo(240, 0);
    expect((await rect('#M')).x).toBeCloseTo(240, 0);
    expect((await rect('#lbl')).w).toBeGreaterThan(0);
  });

  it('collapsed: an icon strip, one entry tile with the padding either side and the edge beyond it, the label kept for screen readers but not shown', async () => {
    await layout(1000, { 'data-expanded': 'false' });
    const strip = await rect('#D');
    const tile = await rect('#I');
    // The drawer is border-box: its 1px edge is inside its width, so the
    // strip is a large mark (2.25 units) and the padding (0.5 units) either
    // side, plus the edge. One pixel less leaves the tile off-centre.
    expect(tile.w).toBeCloseTo(36, 0);
    expect(strip.w).toBeCloseTo(36 + 2 * 8 + 1, 0);
    expect(tile.x - strip.x).toBeCloseTo(8, 1);
    expect(strip.x + strip.w - 1 - (tile.x + tile.w)).toBeCloseTo(8, 1);
    expect((await rect('#M')).x).toBeCloseTo(strip.w, 0);
    expect((await rect('#lbl')).w).toBeLessThanOrEqual(1);
    expect(await page.$eval('#lbl', (el) => el.textContent)).toBe('Scratchpad');
  });

  it('never shows the backdrop, even if marked open', async () => {
    await layout(1000, { 'data-expanded': 'true', 'data-open': 'true' });
    expect(await css('#B', 'display')).toBe('none');
  });

  it('keeps its width beside main content far wider than the layout, expanded and collapsed', async () => {
    // A long message or a wide table makes the main area's preferred width
    // huge. The drawer is a fixed column: the main area gives way, never it.
    for (const expanded of ['true', 'false']) {
      await layout(1000, { 'data-expanded': expanded });
      const want = (await rect('#D')).w;
      await page.$eval('#M', (m) => { m.textContent = 'supercalifragilistic '.repeat(400) + 'x'.repeat(2000); });
      expect((await rect('#D')).w, `expanded=${expanded}`).toBeCloseTo(want, 0);
      expect((await rect('#M')).x, `expanded=${expanded}`).toBeCloseTo(want, 0);
    }
  });

  it('mirrors for side="end"', async () => {
    await layout(1000, { 'data-expanded': 'true', 'data-side': 'end' });
    expect((await rect('#D')).x).toBeCloseTo(760, 0);
    expect((await rect('#M')).x).toBeCloseTo(0, 0);
  });
});

describe('overlay (container below the breakpoint)', () => {
  it('reports its mode to script', async () => {
    await layout(600, {});
    expect(await css('#D', '--boogy-drawer-mode')).toBe('overlay');
  });

  it('closed: off-canvas and not focusable, the main area takes the full width', async () => {
    await layout(600, { 'data-open': 'false' });
    expect((await rect('#D')).x + (await rect('#D')).w).toBeLessThanOrEqual(0);
    expect(await css('#D', 'visibility')).toBe('hidden');
    expect((await rect('#M')).w).toBeCloseTo(600, 0);
  });

  it('open: over the content, with a backdrop, labels shown whatever `expanded` says', async () => {
    await layout(600, { 'data-open': 'true', 'data-expanded': 'false' });
    expect((await rect('#D')).x).toBeCloseTo(0, 0);
    expect(await css('#D', 'visibility')).toBe('visible');
    expect((await rect('#M')).w).toBeCloseTo(600, 0);
    expect(await css('#B', 'pointer-events')).toBe('auto');
    expect((await rect('#lbl')).w).toBeGreaterThan(1);
  });

  it('follows the breakpoint variant: lg keeps overlay at 1000px', async () => {
    await layout(1000, { 'data-expanded': 'true' });
    await page.$eval('#L', (el) => el.setAttribute('data-collapse-at', 'lg'));
    expect(await css('#D', '--boogy-drawer-mode')).toBe('overlay');
  });
});

describe('the title entry', () => {
  // Every entry's mark is the large mark, the title's included: the title
  // is larger in its label, its mark's letters and its row, not its tile.
  it("is larger than an ordinary entry: its label, its mark's letters and its row, on the same tile", async () => {
    await layout(1000, { 'data-expanded': 'true' });
    const px = async (id: string) => parseFloat(await css(id, 'font-size'));
    expect(await px('#tlbl')).toBeGreaterThan(await px('#lbl'));
    expect(await px('#tmark')).toBeGreaterThan(await px('#imark'));
    expect((await rect('#T')).h).toBeGreaterThanOrEqual((await rect('#I')).h);
    expect((await rect('#tmark')).w).toBeCloseTo((await rect('#imark')).w, 1);
  });

  it('is not drawn on the collapsed strip, whose head is the toggle', async () => {
    await layout(1000, { 'data-expanded': 'false' });
    expect(await css('#T', 'display')).toBe('none');
    expect((await rect('#tmark')).w).toBe(0);
  });
});

describe('the drawer edge', () => {
  const edges = () => page.$eval('#D', (el) => [getComputedStyle(el).borderLeftWidth, getComputedStyle(el).borderRightWidth]);

  it("off-canvas, it draws the drawer edge on its inline end, as docked; on the end side, on its start", async () => {
    await layout(600, { 'data-open': 'true' });
    expect(await edges()).toEqual(['0px', '1px']);
    await layout(600, { 'data-open': 'true', 'data-side': 'end' });
    expect(await edges()).toEqual(['1px', '0px']);
  });

  it('docked, the docked edge still applies, and a resizable expanded drawer leaves its edge to the handle', async () => {
    await layout(1000, { 'data-expanded': 'false', 'data-resizable': 'true' });
    expect(await edges()).toEqual(['0px', '1px']);
    await layout(1000, { 'data-expanded': 'false', 'data-side': 'end' });
    expect(await edges()).toEqual(['1px', '0px']);
    await layout(1000, { 'data-expanded': 'true', 'data-resizable': 'true' });
    expect(await edges()).toEqual(['0px', '0px']);
  });
});

describe('the layout never scrolls', () => {
  it('focusing a control that stands past its bottom edge leaves it where it is', async () => {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div id="L" data-boogy="drawer-layout" data-collapse-at="md" style="width:1000px;height:300px">
          <nav id="D" data-boogy="drawer"></nav>
          <main data-boogy="drawer-main"><div style="height:600px"></div><button id="far">Far</button></main>
        </div>`;
    });
    // It does stand past the edge: something a scroller would bring into view.
    const [far, edge] = await page.evaluate(() => [document.getElementById('far')!.getBoundingClientRect().top, document.getElementById('L')!.getBoundingClientRect().bottom]);
    expect(far).toBeGreaterThan(edge);
    await page.focus('#far');
    expect(await page.$eval('#far', (el) => el === document.activeElement)).toBe(true);
    expect(await page.$eval('#L', (el) => [el.scrollTop, el.scrollLeft])).toEqual([0, 0]);
  });
});

describe('a list and a section on the collapsed strip', () => {
  /** A members-style drawer: a section with a glyph and a meta, an action and
   *  a description, over a list of people with avatars; and a plain section. */
  async function people(): Promise<void> {
    await page.evaluate(() => {
      const person = (name: string) => `<li><div data-boogy="list-item"><span data-slot="media"><span class="av" data-boogy="avatar" data-size="sm" role="img" aria-label="${name}"></span></span><span data-slot="text"><span data-slot="title">${name}</span></span><span data-slot="end"><button>x</button></span></div></li>`;
      document.body.innerHTML = `
        <div data-boogy="drawer-layout" data-collapse-at="md" data-expanded="false" style="width:1000px;height:600px">
          <div id="D" data-boogy="drawer">
            <section id="S" data-boogy="section">
              <div id="SH" data-slot="head">
                <h3 data-slot="header"><svg id="G" data-boogy="glyph" data-size="md" data-slot="glyph" viewBox="0 0 24 24"></svg><span id="ST" data-slot="title">Members</span><span id="SM" data-slot="meta"><span data-slot="separator" aria-hidden="true"> · </span>3</span></h3>
                <button id="SA">All</button>
                <p id="SD" data-slot="description">Who is here</p>
              </div>
              <ul data-boogy="list">${['tess', 'carol', 'dave'].map(person).join('')}</ul>
            </section>
            <section data-boogy="section"><div id="PH" data-slot="head"><h3 data-slot="header"><span data-slot="title">Plain</span></h3></div><p>body</p></section>
          </div>
          <main data-boogy="drawer-main">main</main>
        </div>`;
    });
  }
  const box = (sel: string) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom }; });

  it('fits: nothing overflows the strip, and each avatar is an entry-sized mark centred in it', async () => {
    await people();
    const d = await page.$eval('#D', (el) => ({ client: el.clientWidth, scroll: el.scrollWidth, x: el.getBoundingClientRect().x, w: el.clientWidth }));
    expect(d.scroll).toBeLessThanOrEqual(d.client);
    const avatars = await page.$$eval('.av', (els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, w: r.width, h: r.height }; }));
    expect(avatars).toHaveLength(3);
    for (const a of avatars) {
      expect(a.w).toBeCloseTo(36, 0); // --mark-lg at --u 16px
      expect(a.h).toBeCloseTo(36, 0);
      expect(a.x + a.w / 2).toBeCloseTo(d.x + d.w / 2, 0);
    }
    expect(await css('[data-slot="end"]', 'display')).toBe('none');
    expect((await box('[data-boogy="list-item"] > [data-slot="text"]')).w).toBeLessThanOrEqual(1);
  });

  it("a section's head is its glyph over its meta, then a rule with the same space above and below it", async () => {
    await people();
    const glyph = await box('#G');
    const meta = await box('#SM');
    const head = await box('#SH');
    const first = await box('.av');
    expect(glyph.w).toBeGreaterThan(0);
    expect(meta.y).toBeGreaterThan(glyph.b);
    expect((await box('#ST')).w).toBeLessThanOrEqual(1);
    expect(await css('#SA', 'display')).toBe('none');
    expect(await css('#SD', 'display')).toBe('none');
    expect(await css('#SH', 'border-bottom-width')).toBe('1px');
    // From the digits' baseline, where their ink ends: a zero-height marker
    // set on it. The meta's own box is no measure — untrimmed, it grows by its
    // leading, and the space below the letters with it.
    const baseline = await page.$eval('#SM', (el) => {
      const mark = document.createElement('span');
      mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
      el.append(mark);
      const y = mark.getBoundingClientRect().y;
      mark.remove();
      return y;
    });
    const above = head.b - 1 - baseline;
    const below = first.y - head.b;
    expect(above).toBeGreaterThan(0);
    expect(below).toBeCloseTo(above, 0);
  });

  it('a section with neither a glyph nor a meta has no head on the strip, and keeps it expanded', async () => {
    await people();
    expect(await css('#PH', 'display')).toBe('none');
    expect(await css('#SH', 'display')).toBe('flex');
    await page.$eval('[data-boogy="drawer-layout"]', (el) => el.setAttribute('data-expanded', 'true'));
    expect(await css('#PH', 'display')).toBe('grid');
    expect(await css('#G', 'display')).toBe('none');
  });
});

describe("a drawer's foot and its one-state toggles", () => {
  /** A members drawer on the end side: a section whose action is the
   *  expanded-only toggle, `people` list items, and a foot holding a button
   *  and the collapsed-only toggle. */
  async function members(expanded: boolean, people: number): Promise<void> {
    await page.evaluate(({ expanded, people }) => {
      const person = (i: number) => `<li><div data-boogy="list-item"><span data-slot="media"><span data-boogy="avatar" data-size="sm"></span></span><span data-slot="text"><span data-slot="title">p${i}</span></span></div></li>`;
      document.body.innerHTML = `
        <div data-boogy="drawer-layout" data-collapse-at="md" data-side="end" data-expanded="${expanded}" style="width:1000px;height:400px">
          <div id="D" data-boogy="drawer">
            <div data-slot="body"><section data-boogy="section">
              <div data-slot="head"><h3 data-slot="header"><span data-slot="title">Members</span></h3><button id="HT" data-boogy="button" data-role="drawer-toggle" data-shown="expanded">x</button></div>
              <ul data-boogy="list">${Array.from({ length: people }, (_, i) => person(i)).join('')}</ul>
            </section></div>
            <div id="F" data-slot="foot"><button id="INV" data-boogy="button">Invite people</button><button id="FT" data-boogy="button" data-role="drawer-toggle" data-shown="collapsed">x</button></div>
          </div>
          <main data-boogy="drawer-main">main</main>
        </div>`;
    }, { expanded, people });
  }
  const bottom = (sel: string) => page.$eval(sel, (el) => el.getBoundingClientRect().bottom);

  it("sits flush on the drawer's bottom edge, short list or long, on the drawer's ground, and a long list scrolls up to it", async () => {
    await members(true, 2);
    expect(await bottom('#F')).toBeCloseTo(await bottom('#D'), 0);
    expect(await css('#F', 'background-color')).toBe('rgba(0, 0, 0, 0)');
    await members(true, 40);
    expect(await bottom('#F')).toBeCloseTo(await bottom('#D'), 0);
    const body = await page.$eval('#D > [data-slot="body"]', (el) => ({ client: el.clientHeight, scroll: el.scrollHeight, bottom: el.getBoundingClientRect().bottom }));
    expect(body.scroll).toBeGreaterThan(body.client);
    // Nothing paints below the body: the list stops at the foot's rule.
    expect(body.bottom).toBeLessThanOrEqual((await page.$eval('#F', (el) => el.getBoundingClientRect().top)) + 0.5);
    expect(await page.$eval('#D', (el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  });

  it('expanded: the header toggle and the foot button show, the foot toggle does not; on the strip the reverse', async () => {
    await members(true, 3);
    expect(await css('#HT', 'display')).not.toBe('none');
    expect(await css('#INV', 'display')).not.toBe('none');
    expect(await css('#FT', 'display')).toBe('none');
    await members(false, 3);
    expect(await css('#HT', 'display')).toBe('none');
    expect(await css('#INV', 'display')).toBe('none');
    expect(await css('#FT', 'display')).not.toBe('none');
    expect(await bottom('#F')).toBeCloseTo(await bottom('#D'), 0);
  });

  it('overlaid (below the breakpoint), it is open, so the collapsed-only toggle hides', async () => {
    await members(false, 3);
    await page.$eval('[data-boogy="drawer-layout"]', (el) => { el.setAttribute('style', 'width:600px;height:400px'); el.setAttribute('data-open', 'true'); });
    expect(await css('#FT', 'display')).toBe('none');
    expect(await css('#HT', 'display')).not.toBe('none');
  });
});

describe("a drawer's head", () => {
  it('stays put while the body under it scrolls', async () => {
    await page.evaluate(() => {
      const rows = Array.from({ length: 40 }, (_, i) => `<li><div data-boogy="list-item"><span data-slot="text"><span data-slot="title">p${i}</span></span></div></li>`).join('');
      document.body.innerHTML = `
        <div data-boogy="drawer-layout" data-collapse-at="md" data-side="end" data-expanded="true" style="width:1000px;height:400px">
          <div id="D" data-boogy="drawer">
            <div id="H" data-slot="head"><section data-boogy="section"><div data-slot="head"><h3 data-slot="header"><span data-slot="title">Members</span></h3></div></section></div>
            <div id="B" data-slot="body"><ul data-boogy="list">${rows}</ul></div>
          </div>
          <main data-boogy="drawer-main">main</main>
        </div>`;
    });
    const top = () => page.$eval('#H', (el) => el.getBoundingClientRect().top);
    const before = await top();
    const scrolled = await page.$eval('#B', (el) => { el.scrollTop = 500; return el.scrollTop; });
    expect(scrolled).toBeGreaterThan(0);
    expect(await top()).toBeCloseTo(before, 0);
    expect(await page.$eval('#D', (el) => el.scrollTop)).toBe(0);
    // The list starts below the head: nothing scrolls over it.
    const headBottom = await page.$eval('#H', (el) => el.getBoundingClientRect().bottom);
    const bodyTop = await page.$eval('#B', (el) => el.getBoundingClientRect().top);
    expect(bodyTop).toBeGreaterThanOrEqual(headBottom);
  });
});
