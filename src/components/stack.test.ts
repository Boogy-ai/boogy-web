import { describe, it, expect } from 'vitest';
import { stack, STACK_GAPS } from './stack';
import { COMPONENTS_CSS } from './components-css';

const CODE = COMPONENTS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (sel: string) => { const at = CODE.indexOf(`${sel} {`); return at < 0 ? null : CODE.slice(at, CODE.indexOf('}', at)); };

describe('stack', () => {
  it('is a column with the middle gap unless told otherwise', () => {
    expect(stack()).toEqual({ 'data-boogy': 'stack', 'data-direction': 'column', 'data-gap': '2' });
  });
  it('can be a row that wraps', () => {
    expect(stack({ direction: 'row', gap: 1 })).toEqual({ 'data-boogy': 'stack', 'data-direction': 'row', 'data-gap': '1' });
  });
  it('refuses a gap off the scale', () => {
    expect(() => stack({ gap: 9 as never })).toThrow(/gap/);
  });
  it('every gap is a space token, a row wraps, and children bring no margins', () => {
    for (const g of STACK_GAPS) expect(rule(`[data-boogy="stack"][data-gap="${g}"]`)).toMatch(new RegExp(`gap:\\s*var\\(--space-${g}\\)`));
    expect(rule('[data-boogy="stack"][data-direction="row"]')).toMatch(/flex-direction:\s*row[\s\S]*flex-wrap:\s*wrap/);
    expect(rule('[data-boogy="stack"] > *')).toMatch(/margin:\s*0/);
  });
});

describe('the stylesheet has a block for every part', () => {
  it.each([
    ['[data-boogy="thumbnail"]', /overflow:\s*hidden/],
    ['[data-boogy="thumbnail"][data-size="md"]', /width:\s*var\(--thumb-md\)/],
    ['[data-boogy="notice"]', /font-size:\s*var\(--fs-caption\)/],
    ['[data-boogy="notice"][data-tone="warning"]', /color:\s*var\(--warn\)/],
    ['[data-boogy="info-list"]', /grid-template-columns/],
    ['[data-boogy="detail-header"]', /container-type:\s*inline-size/],
  ])('%s', (sel, prop) => {
    expect(rule(sel)).toMatch(prop);
  });
});
