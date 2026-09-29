import { describe, it, expect } from 'vitest';
import { sheet, field, section } from './sheet';
import { COMPONENTS_CSS } from './components-css';

const CODE = COMPONENTS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
function ruleFor(selector: string): string | null {
  const at = CODE.indexOf(`${selector} {`);
  return at < 0 ? null : CODE.slice(at, CODE.indexOf('}', at));
}

describe('sheet', () => {
  it('marks a window-filling frame', () => {
    expect(sheet()).toEqual({ 'data-boogy': 'sheet' });
  });
  it('fills the viewport and never scrolls as a page: only its body scrolls', () => {
    // Fixed to the window, not a 100dvh box: a host page's default body margin
    // would push a 100dvh box past the window and scroll the page.
    expect(ruleFor('[data-boogy="sheet"]')).toMatch(/position:\s*fixed/);
    expect(ruleFor('[data-boogy="sheet"]')).toMatch(/inset:\s*0/);
    expect(ruleFor('[data-boogy="sheet"]')).toMatch(/overflow:\s*hidden/);
    expect(ruleFor('[data-boogy="sheet"] > [data-slot="body"]')).toMatch(/overflow:\s*auto/);
  });
  it('carries the document baseline an SDK page needs: ground, ink and the body font', () => {
    const r = ruleFor('[data-boogy="sheet"]') ?? '';
    expect(r).toMatch(/background:\s*var\(--ground\)/);
    expect(r).toMatch(/font-family:\s*var\(--font-body\)/);
  });
});

describe('field', () => {
  it('marks a labelled control, and says when it is invalid', () => {
    expect(field()).toEqual({ 'data-boogy': 'field' });
    expect(field({ invalid: true })).toEqual({ 'data-boogy': 'field', 'data-invalid': 'true' });
  });
  it('an invalid field shows its message in the danger colour and edges its control', () => {
    expect(ruleFor('[data-boogy="field"][data-invalid="true"] > [data-slot="message"]')).toMatch(/var\(--danger\)/);
    expect(ruleFor('[data-boogy="field"][data-invalid="true"] > [data-slot="control"]')).toMatch(/var\(--danger\)/);
  });
  it('a fixed prefix sits inside the control frame: the group carries the edge, the input inside it does not', () => {
    const group = ruleFor('[data-boogy="field"] > [data-slot="group"]') ?? '';
    expect(group).toMatch(/border:\s*1px solid var\(--edge\)/);
    expect(ruleFor('[data-boogy="field"] > [data-slot="group"] > [data-slot="control"]')).toMatch(/border:\s*none/);
    expect(ruleFor('[data-boogy="field"] > [data-slot="group"] > [data-slot="prefix"]')).toMatch(/color:\s*var\(--text-3\)/);
    expect(ruleFor('[data-boogy="field"][data-invalid="true"] > [data-slot="group"]')).toMatch(/var\(--danger\)/);
  });
  it('an empty message takes no room', () => {
    expect(ruleFor('[data-boogy="field"] > [data-slot="message"]:empty')).toMatch(/display:\s*none/);
  });
});

describe('section', () => {
  it('marks a titled group', () => {
    expect(section()).toEqual({ 'data-boogy': 'section' });
  });
  it('its header is the small uppercase caption used above groups', () => {
    // Two markups share the rule: the header as the section's own child, and
    // inside a head row beside an action.
    const r = ruleFor('[data-boogy="section"] > [data-slot="head"] > [data-slot="header"]') ?? '';
    expect(COMPONENTS_CSS).toContain('[data-boogy="section"] > [data-slot="header"],');
    expect(r).toMatch(/text-transform:\s*uppercase/);
    expect(r).toMatch(/font-size:\s*var\(--fs-caption\)/);
  });
});
