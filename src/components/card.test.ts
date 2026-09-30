import { describe, it, expect } from 'vitest';
import { card, cardGrid } from './card';
import { COMPONENTS_CSS } from './components-css';

const CODE = COMPONENTS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (sel: string) => { const at = CODE.indexOf(`${sel} {`); return at < 0 ? null : CODE.slice(at, CODE.indexOf('}', at)); };

describe('card and card grid', () => {
  it('name their parts', () => {
    expect(card()).toEqual({ 'data-boogy': 'card' });
    expect(cardGrid()).toEqual({ 'data-boogy': 'card-grid', 'data-variant': 'spaced' });
    expect(cardGrid({ variant: 'flush' })).toEqual({ 'data-boogy': 'card-grid', 'data-variant': 'flush' });
  });
  it('the grid is responsive, never wider than three columns, and a short row stretches to fill', () => {
    // Columns no narrower than --card-min, and no more than three however
    // wide the grid: the floor is the larger of --card-min and a third.
    // auto-FIT, so a row of fewer cards than columns stretches them across.
    const g = rule('[data-boogy="card-grid"]')!;
    expect(g).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(max\(var\(--card-min\),\s*\(100% - 2 \* var\(--space-2\)\) \/ 3\),\s*1fr\)\)/);
    expect(g).toMatch(/gap:\s*var\(--space-2\)/);
  });
  it('a card is a column whose foot sits at the bottom, so a row of cards aligns', () => {
    expect(rule('[data-boogy="card"]')).toMatch(/display:\s*flex[\s\S]*flex-direction:\s*column/);
    expect(rule('[data-boogy="card"] > [data-slot="foot"]')).toMatch(/margin-top:\s*auto/);
  });
  it('a control in the title covers the whole card, under the foot', () => {
    const title = '[data-boogy="card"] [data-slot="title"] > :is(button, a)';
    expect(rule(title)).toMatch(/all:\s*unset/);
    expect(rule(`${title}::after`)).toMatch(/position:\s*absolute[\s\S]*inset:\s*0/);
    expect(rule('[data-boogy="card"] > [data-slot="foot"]')).toMatch(/position:\s*relative/);
  });
  it('a summary is clamped to three lines', () => {
    expect(rule('[data-boogy="card"] [data-slot="summary"]')).toMatch(/-webkit-line-clamp:\s*3/);
  });
  it('flush: cards abut on hairline dividers, no gaps, no outer frame', () => {
    const grid = rule('[data-boogy="card-grid"][data-variant="flush"]')!;
    expect(grid).toMatch(/gap:\s*0/);
    expect(grid).toMatch(/overflow:\s*hidden/);
    // A line above the first row and below the last; the sides are whatever
    // the grid sits in (a popover's own border, say).
    expect(grid).toMatch(/border-block:\s*1px solid var\(--card-divider\)/);
    const c = rule('[data-boogy="card-grid"][data-variant="flush"] [data-boogy="card"]')!;
    expect(c).toMatch(/border-radius:\s*0/);
    expect(c).toMatch(/background:\s*transparent/);
    // A divider (a real border, not a shadow) on each card's right and bottom,
    // one hairline past its cell, so the grid clips the ones on its own edge
    // and only the lines BETWEEN cards show.
    expect(c).toMatch(/border-right:\s*1px solid var\(--card-divider\)/);
    expect(c).toMatch(/border-bottom:\s*1px solid var\(--card-divider\)/);
    expect(c).toMatch(/margin:\s*0 -1px -1px 0/);
    // Sized by its cell, not width: 100% — a fixed width would swallow the
    // negative margin and leave the edge card's divider inside the grid.
    expect(c).toMatch(/width:\s*auto/);
    expect(c).toMatch(/flex:\s*1 1 auto/);
  });
  it('flush: the focus ring is drawn inside the card, where the grid cannot clip it', () => {
    expect(rule('[data-boogy="card-grid"][data-variant="flush"] [data-boogy="card"]:has([data-slot="title"] > :focus-visible)'))
      .toMatch(/outline-offset:\s*calc\(var\(--ring\) \* -1\)/);
  });
});

describe('thumbnail corners', () => {
  it('are only softened: radius-1, and radius-2 at the large size, never radius-3', () => {
    expect(rule('[data-boogy="thumbnail"]')).toMatch(/border-radius:\s*var\(--radius-1\)/);
    expect(rule('[data-boogy="thumbnail"][data-size="md"]') ?? '').not.toMatch(/radius-[23]/);
    expect(rule('[data-boogy="thumbnail"][data-size="lg"]')).toMatch(/border-radius:\s*var\(--radius-2\)/);
  });
});

describe('button corners', () => {
  it('are only softened, like the rest of the system', () => {
    expect(rule('[data-boogy="button"]')).toMatch(/border-radius:\s*var\(--radius-1\)/);
  });
});
