import { describe, it, expect } from 'vitest';
import { tile, tileGrid } from './tile';
import { list, listItem } from './list';
import { COMPONENTS_CSS } from './components-css';

const CODE = COMPONENTS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (sel: string) => { const at = CODE.indexOf(`${sel} {`); return at < 0 ? null : CODE.slice(at, CODE.indexOf('}', at)); };

describe('tile and list attrs', () => {
  it('name their parts', () => {
    expect(tile()).toEqual({ 'data-boogy': 'tile' });
    expect(tileGrid()).toEqual({ 'data-boogy': 'tile-grid' });
    expect(list()).toEqual({ 'data-boogy': 'list' });
    expect(listItem()).toEqual({ 'data-boogy': 'list-item' });
  });
});

describe('long text never pushes the layout apart', () => {
  it("a tile's title clamps to two lines", () => {
    expect(rule('[data-boogy="tile"] > [data-slot="title"]')).toMatch(/-webkit-line-clamp:\s*2/);
  });
  it("a row's title, subtitle and description each end in an ellipsis", () => {
    for (const s of ['title', 'subtitle', 'description']) {
      expect(rule(`[data-boogy="list-item"] [data-slot="${s}"]`)).toMatch(/text-overflow:\s*ellipsis/);
    }
  });
  it('a tile title that is one long word wraps inside its tile', () => {
    expect(rule('[data-boogy="tile"] > [data-slot="title"]')).toMatch(/overflow-wrap:\s*anywhere/);
  });
  it('a tile and a row include their padding in their width', () => {
    expect(rule('[data-boogy="tile"]')).toMatch(/box-sizing:\s*border-box/);
    expect(rule('[data-boogy="list-item"]')).toMatch(/box-sizing:\s*border-box/);
  });
  it('the trailing action never shrinks, and sits above a title control', () => {
    expect(rule('[data-boogy="list-item"] > [data-slot="end"]')).toMatch(/flex:\s*none/);
    expect(rule('[data-boogy="list-item"] > [data-slot="end"]')).toMatch(/position:\s*relative/);
  });
  it('a control in the title reads as the title and covers the whole row', () => {
    const title = '[data-boogy="list-item"] [data-slot="title"] > :is(button, a)';
    expect(rule(title)).toMatch(/all:\s*unset/);
    // A block that ends in an ellipsis, like the title it stands in for: unset,
    // it would be an inline box the title's own ellipsis cannot reach.
    expect(rule(title)).toMatch(/display:\s*block[\s\S]*text-overflow:\s*ellipsis/);
    expect(rule(`${title}::after`)).toMatch(/position:\s*absolute[\s\S]*inset:\s*0/);
    const row = '[data-boogy="list-item"]:has([data-slot="title"] > :is(button, a))';
    expect(rule(row)).toMatch(/position:\s*relative/);
    expect(rule(`${row}:hover`)).toMatch(/background:\s*var\(--fill-hover\)/);
    expect(rule('[data-boogy="list-item"]:has([data-slot="title"] > :focus-visible)')).toMatch(/outline:\s*var\(--ring\)/);
  });
  it('the grid fills its width with columns no narrower than --tile-min', () => {
    expect(rule('[data-boogy="tile-grid"]')).toMatch(/repeat\(auto-fill,\s*minmax\(var\(--tile-min\),\s*1fr\)\)/);
  });
});
