// Two drawers in a real browser: rooms on the start side around members on
// the end side, as a chat lays out. Each folds to its rail on its own, and
// neither layout's state reaches the other's drawer or toggles.
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
    resolve: { alias: [{ find: /^@boogy\/web$/, replacement: fileURLToPath(new URL('../src/index.ts', import.meta.url)) }] },
    oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL('./fixtures/two-drawers.fixture.tsx', import.meta.url)), formats: ['iife'], name: 'DrawersFixtureBundle' },
    },
  });
  const result = Array.isArray(out) ? out[0] : out;
  return (result as { output: { type: string; code?: string }[] }).output.find((o) => o.type === 'chunk')!.code!;
}

beforeAll(async () => {
  if (!existsSync(BROWSER)) throw new Error(`no browser at ${BROWSER}; set BOOGY_TEST_BROWSER`);
  const code = await bundle();
  browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
  await page.evaluate((css, code) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${css}`);
    document.adoptedStyleSheets = [sheet];
    (0, eval)(code);
  }, FOUNDATION_CSS + COMPONENTS_CSS, code);
}, 60_000);
afterAll(async () => { await browser?.close(); });

type F = { drawersFixture: { mount(w: number, rooms: boolean, members: boolean): void } };
const mount = async (w: number, rooms: boolean, members: boolean) => {
  await page.evaluate((w, r, m) => (window as unknown as F).drawersFixture.mount(w, r, m), w, rooms, members);
  await new Promise((r) => setTimeout(r, 100));
};
const look = () => page.evaluate(() => {
  const box = (id: string) => { const r = document.getElementById(id)!.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) }; };
  const shown = (id: string) => getComputedStyle(document.getElementById(id)!).display !== 'none';
  const pip = (id: string) => getComputedStyle(document.getElementById(id)!, '::before').content !== 'none';
  const mode = (id: string) => getComputedStyle(document.getElementById(id)!).getPropertyValue('--boogy-drawer-mode').trim();
  const chevron = (id: string) => getComputedStyle(document.querySelector(`#${id} [data-slot="chevron"]`)!).scale;
  const ring = getComputedStyle(document.querySelector('#room-Design [data-slot="media"] > *')!).boxShadow;
  return {
    rooms: box('RD'), members: box('MD'), main: box('C'),
    roomsExpand: shown('RT'), membersCollapse: shown('MH'), membersExpand: shown('MT'),
    pipUnread: pip('room-General'), pipRead: pip('room-Random'), pipCurrent: pip('room-Design'), ring,
    barChevron: chevron('BT'), membersChevron: chevron('MH'),
    row: box('room-General').h, normalRow: box('member-theo').h, modes: [mode('RD'), mode('MD')],
  };
});

describe('rooms on the start side, members on the end, in one wide pane', () => {
  it('both open: rooms, the conversation, members, side by side', async () => {
    await mount(1280, true, true);
    const v = await look();
    expect(v.modes).toEqual(['docked', 'docked']);
    expect(v.rooms.x).toBe(0);
    expect(v.rooms.w).toBeGreaterThan(200);
    expect(v.members.w).toBe(v.rooms.w);
    expect(v.members.x).toBe(1280 - v.members.w);
    expect(v.main.x).toBe(v.rooms.w);
    // The nested layout fills the main area it is in: members as tall as rooms.
    expect(v.members.h).toBe(v.rooms.h);
    expect(v.rooms.h).toBe(600);
    expect(v.roomsExpand).toBe(false);
    expect(v.membersExpand).toBe(false);
    expect(v.membersCollapse).toBe(true);
    // Each toggle points the way its own drawer goes: the rooms' toggle in the
    // conversation's bar (inside the members' layout) points start-ward, to
    // fold the rooms; the members' toggle end-ward.
    expect(v.barChevron).toBe('none');
    expect(v.membersChevron).toBe('-1 1');
    // Compact rows sit closer than a normal list's, with the same avatar.
    expect(v.row).toBeLessThan(v.normalRow);
  });

  it('rooms folded to their rail: members untouched, and its toggles too', async () => {
    await mount(1280, false, true);
    const v = await look();
    expect(v.rooms.w).toBeLessThan(100);
    expect(v.members.w).toBeGreaterThan(200);
    expect(v.roomsExpand).toBe(true);
    expect(v.membersExpand).toBe(false);
    expect(v.membersCollapse).toBe(true);
    // The rail: a pip at the edge for the unread room and a taller one for the
    // open room, whose avatar is also the only one not dimmed (below); no ring.
    expect(v.pipUnread).toBe(true);
    expect(v.pipCurrent).toBe(true);
    expect(v.pipRead).toBe(false);
    expect(v.ring).not.toMatch(/ 0px 0px 0px [\d.]+px/);
  });

  it('members folded: rooms untouched', async () => {
    await mount(1280, true, false);
    const v = await look();
    expect(v.rooms.w).toBeGreaterThan(200);
    expect(v.members.w).toBeLessThan(100);
    expect(v.roomsExpand).toBe(false);
    expect(v.membersExpand).toBe(true);
    expect(v.pipUnread).toBe(false);
  });

  it('a narrow pane lays both over the conversation', async () => {
    await mount(600, true, true);
    expect((await look()).modes).toEqual(['overlay', 'overlay']);
  });
});

const ground = (id: string) => page.evaluate((id) => getComputedStyle(document.getElementById(id)!).backgroundColor, id);
const CLEAR = 'rgba(0, 0, 0, 0)';

describe('a plain drawer, a nav list and a search field on the strip', () => {
  it("docked, the plain drawer (members) has no ground of its own; the rooms' drawer has one", async () => {
    await mount(1000, true, true);
    expect(await ground('MD')).toBe(CLEAR);
    expect(await ground('RD')).not.toBe(CLEAR);
  });
  it('slid over the conversation, the plain drawer has a ground, or the conversation would show through it', async () => {
    await mount(600, true, true);
    expect(await ground('MD')).not.toBe(CLEAR);
  });
  it("the open room is filled with the accent", async () => {
    await mount(1000, true, true);
    const [row, accent] = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.background = 'var(--accent)';
      document.getElementById('room-Design')!.append(probe);
      const out = [getComputedStyle(document.getElementById('room-Design')!).backgroundColor, getComputedStyle(probe).backgroundColor];
      probe.remove();
      return out;
    });
    expect(row).toBe(accent);
  });
  it("folded, a list's avatars are the strip's mark size, however small they are open", async () => {
    await mount(1000, false, true);
    const [media, mark] = await page.evaluate(() => {
      const probe = document.createElement('span');
      Object.assign(probe.style, { display: 'block', width: 'var(--mark-lg)' });
      document.getElementById('RD')!.append(probe);
      const out = [document.querySelector('#room-General [data-slot="media"] > *')!.getBoundingClientRect().width, probe.getBoundingClientRect().width];
      probe.remove();
      return out;
    });
    expect(media).toBeCloseTo(mark, 1);
  });
  it("folded, the open room shows by opacity alone: its avatar whole, the others dimmed; no fill, no outline", async () => {
    await mount(1000, false, true);
    const v = await page.evaluate(() => {
      const look = (id: string) => {
        const row = document.getElementById(id)!;
        const media = row.querySelector('[data-slot="media"]')!;
        return { opacity: Number(getComputedStyle(media).opacity), fill: getComputedStyle(row).backgroundColor, shadow: getComputedStyle(media.firstElementChild!).boxShadow };
      };
      return { open: look('room-Design'), other: look('room-Random') };
    });
    expect(v.open.opacity).toBe(1);
    expect(v.other.opacity).toBeLessThan(0.7);
    // Its pip: a thin rail at the edge, a bit thinner than a quarter unit,
    // as tall as a large space.
    const [pip, quarter, tall] = await page.evaluate(() => {
      const probe = (v: string) => { const p = document.createElement('span'); Object.assign(p.style, { display: 'block', width: v }); document.getElementById('RD')!.append(p); const w = p.getBoundingClientRect().width; p.remove(); return w; };
      const b = getComputedStyle(document.getElementById('room-Design')!, '::before');
      return [parseFloat(b.width), probe('var(--space-1)'), Math.abs(parseFloat(b.height) - probe('var(--space-5)'))];
    });
    expect(pip).toBeGreaterThan(quarter * 0.6);
    expect(pip).toBeLessThan(quarter * 0.9);
    expect(tall).toBeLessThan(0.5);
    expect(v.open.fill).toBe('rgba(0, 0, 0, 0)');
    expect(v.open.shadow).not.toMatch(/ 0px 0px 0px [\d.]+px/);
  });
  it('folded, nothing at the top of the list is cut off, the open one first included', async () => {
    await mount(1000, false, true);
    const { tile, clip } = await page.evaluate(() => {
      // The open room made the first.
      document.getElementById('room-Design')!.removeAttribute('aria-current');
      document.getElementById('room-General')!.setAttribute('aria-current', 'page');
      const t = document.getElementById('room-General')!.getBoundingClientRect();
      const body = document.querySelector('#RD > [data-slot="body"]')!.getBoundingClientRect();
      return { tile: t.top, clip: body.top };
    });
    await page.evaluate(() => {
      document.getElementById('room-General')!.removeAttribute('aria-current');
      document.getElementById('room-Design')!.setAttribute('aria-current', 'page');
    });
    expect(tile).toBeGreaterThanOrEqual(clip);
  });
  it("folded, an unread room's pip is at the drawer's edge, clear of its avatar", async () => {
    await mount(1000, false, true);
    const { drawer, pipLeft, pipRight, media, clip } = await page.evaluate(() => {
      const row = document.getElementById('room-General')!;
      const before = getComputedStyle(row, '::before');
      const left = row.getBoundingClientRect().left + parseFloat(before.left);
      // The innermost box between the row and the drawer that clips: the pip
      // must be inside it, or it is cut off.
      let clip = -Infinity;
      for (let el = row.parentElement; el && el.id !== 'RD'; el = el.parentElement) {
        if (getComputedStyle(el).overflowX !== 'visible') clip = Math.max(clip, el.getBoundingClientRect().left);
      }
      return {
        drawer: document.getElementById('RD')!.getBoundingClientRect().left,
        pipLeft: left, pipRight: left + parseFloat(before.width),
        media: row.querySelector('[data-slot="media"] > *')!.getBoundingClientRect().left,
        clip,
      };
    });
    expect(pipLeft).toBeCloseTo(drawer, 0);
    expect(pipRight).toBeLessThan(media - 1);
    expect(pipLeft).toBeGreaterThanOrEqual(clip - 0.5);
  });
  it("a title entry and a toggle in a drawer's head share one row, the toggle beside the entry, not inside it", async () => {
    await mount(1000, true, true);
    const [title, toggle] = await page.evaluate(() => ['RTI', 'RHT'].map((id) => {
      const r = document.getElementById(id)!.getBoundingClientRect();
      return { left: r.left, right: r.right, mid: r.top + r.height / 2, w: r.width };
    }));
    expect(toggle.left).toBeGreaterThanOrEqual(title.right);
    expect(Math.abs(toggle.mid - title.mid)).toBeLessThan(2);
    expect(title.w).toBeGreaterThan(100);
    // A picture as the title's mark fills the mark, whatever size it was made at.
    const [mark, picture] = await page.evaluate(() => ['#RTI > [data-slot="mark"]', '#RTI [data-boogy="thumbnail"]'].map((s) => document.querySelector(s)!.getBoundingClientRect().width));
    expect(picture).toBeCloseTo(mark, 1);
  });
  it("folded, a title whose toggle does not show on the strip keeps its logo there, centred, its name hidden", async () => {
    await mount(1000, false, true);
    const v = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const mark = r('#RTI > [data-slot="mark"]'), drawer = r('#RD'), label = r('#RTI > [data-slot="label"]');
      return { shown: getComputedStyle(document.getElementById('RTI')!).display, markW: mark.width, off: Math.abs(mark.left + mark.width / 2 - (drawer.left + drawer.width / 2)), labelW: label.width };
    });
    expect(v.shown).not.toBe('none');
    expect(v.markW).toBeGreaterThan(20);
    expect(v.off).toBeLessThan(1.5);
    expect(v.labelW).toBeLessThanOrEqual(1);
    // A rule under it, with the same space either side, as under a section's
    // glyph and count on the strip.
    const g = await page.evaluate(() => {
      const head = document.querySelector('#RD > [data-slot="head"]')!;
      const h = head.getBoundingClientRect(), mark = document.querySelector('#RTI > [data-slot="mark"]')!.getBoundingClientRect();
      const first = document.querySelector('#room-General [data-slot="media"] > *')!.getBoundingClientRect();
      const rule = parseFloat(getComputedStyle(head).borderBlockEndWidth);
      return { rule, above: h.bottom - rule - mark.bottom, below: first.top - h.bottom };
    });
    expect(g.rule).toBeGreaterThanOrEqual(1);
    expect(Math.abs(g.above - g.below)).toBeLessThan(1);
  });
  it("folded to its strip, a drawer's search field gives way; open, it is there", async () => {
    await mount(1000, true, false);
    const folded = await page.evaluate(() => document.querySelector('#MS [data-boogy="field"]')!.getBoundingClientRect().width);
    expect(folded).toBe(0);
    await mount(1000, true, true);
    const open = await page.evaluate(() => document.querySelector('#MS [data-boogy="field"]')!.getBoundingClientRect().width);
    expect(open).toBeGreaterThan(100);
  });
});
