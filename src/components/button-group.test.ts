import { describe, it, expect } from 'vitest';
import { buttonGroup } from './button-group';
import { ruleFor } from '../../test-support/rule-for';

describe('buttonGroup', () => {
  it('is a named group of buttons, with standard corners by default', () => {
    expect(buttonGroup()).toEqual({ 'data-boogy': 'button-group', role: 'group' });
  });
  it('is fully rounded at its outer ends when asked', () => {
    expect(buttonGroup({ rounded: true })).toEqual({ 'data-boogy': 'button-group', role: 'group', 'data-rounded': 'true' });
  });
});

describe('button group CSS', () => {
  const G = '[data-boogy="button-group"]';
  const B = `${G} > [data-boogy="button"]`;
  it('sits its buttons edge to edge in a row', () => {
    const r = ruleFor(G);
    expect(r).toMatch(/display: inline-flex/);
    expect(r).not.toMatch(/gap:\s*var/);
  });
  it('takes the outer radius from the buttons (standard, or full when rounded) as one token', () => {
    expect(ruleFor(G)).toMatch(/--_r: var\(--radius-1\)/);
    expect(ruleFor(`${G}[data-rounded="true"]`)).toMatch(/--_r: var\(--radius-full\)/);
  });
  it('squares every button corner, then rounds only the outer ends', () => {
    expect(ruleFor(B)).toMatch(/border-radius: 0/);
    expect(ruleFor(`${B}:first-child`)).toMatch(/border-start-start-radius: var\(--_r\)[\s\S]*border-end-start-radius: var\(--_r\)/);
    expect(ruleFor(`${B}:last-child`)).toMatch(/border-start-end-radius: var\(--_r\)[\s\S]*border-end-end-radius: var\(--_r\)/);
    expect(ruleFor(`${B}:first-child`)).not.toMatch(/-end-radius/);
    expect(ruleFor(`${B}:last-child`)).not.toMatch(/-start-radius/);
  });
  it('draws a faint hairline seam between neighbours only, from tokens', () => {
    const seam = ruleFor(`${B} + [data-boogy="button"]`);
    expect(seam).toMatch(/var\(--hairline\)/);
    expect(seam).toMatch(/var\(--edge-faint\)/);
    expect(ruleFor(`${B}:first-child`)).not.toMatch(/--edge/);
  });
  it('raises the focused button so its ring is not covered by a neighbour', () => {
    const r = ruleFor(`${B}:focus-visible`);
    expect(r).toMatch(/position: relative/);
    expect(r).toMatch(/z-index: 1/);
  });
});
