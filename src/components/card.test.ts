import { describe, it, expect } from 'vitest';
import { card, cardGrid } from './card';
import { COMPONENTS_CSS } from './components-css';

const CODE = COMPONENTS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (sel: string) => { const at = CODE.indexOf(`${sel} {`); return at < 0 ? null : CODE.slice(at, CODE.indexOf('}', at)); };

describe('card and card grid', () => {
  it('name their parts', () => {
    expect(card()).toEqual({ 'data-boogy': 'card' });
    expect(cardGrid()).toEqual({ 'data-boogy': 'card-grid' });
  });
  it('the grid is responsive and never wider than three columns', () => {
    // Columns no narrower than --card-min, and no more than three however
    // wide the grid: the floor is the larger of --card-min and a third.
    const g = rule('[data-boogy="card-grid"]')!;
    expect(g).toMatch(/grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(max\(var\(--card-min\),\s*\(100% - 2 \* var\(--space-2\)\) \/ 3\),\s*1fr\)\)/);
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
});
