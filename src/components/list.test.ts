import { describe, it, expect } from 'vitest';
import { list, LIST_VARIANTS } from './list';
import { ruleFor } from '../../test-support/rule-for';

describe('list', () => {
  it('is a plain list by default, marking nothing', () => {
    expect(list()).toEqual({ 'data-boogy': 'list' });
  });
  it('nav: a list of places to go, marked so its look can follow', () => {
    expect(LIST_VARIANTS).toEqual(['plain', 'nav']);
    expect(list({ variant: 'nav', density: 'compact' })).toEqual({ 'data-boogy': 'list', 'data-density': 'compact', 'data-variant': 'nav' });
    expect(() => list({ variant: 'menu' as never })).toThrow(/variant/);
  });
  it("nav: the place open now is filled with the accent, in the accent's ink, its details too", () => {
    const current = ruleFor('[data-boogy="list"][data-variant="nav"] [data-boogy="list-item"][aria-current="page"]');
    expect(current).toContain('background: var(--accent)');
    expect(current).toMatch(/color: oklch\(from var\(--accent\)/);
    expect(ruleFor('[data-boogy="list"][data-variant="nav"] [data-boogy="list-item"][aria-current="page"] :is([data-slot="title"], [data-slot="meta"], [data-slot="subtitle"])')).toContain('color: inherit');
  });
  it("the accent's ink is one value, the solid button's", () => {
    const ink = /color: (oklch\(from var\(--accent\)[^;]*);/;
    const button = ink.exec(ruleFor('[data-boogy="button"][data-variant="solid"]'))?.[1];
    expect(button).toBeTruthy();
    expect(ink.exec(ruleFor('[data-boogy="list"][data-variant="nav"] [data-boogy="list-item"][aria-current="page"]'))?.[1]).toBe(button);
  });
});

describe('a list item title with media', () => {
  it('a glyph before a title sits on its line: one centred row, the glyph its own size, the words truncating', () => {
    const sel = '[data-boogy="list-item"] [data-slot="title"]:has(> :is([data-boogy="avatar"], [data-boogy="thumbnail"], [data-boogy="glyph"]))';
    const row = ruleFor(sel);
    expect(row).toContain('display: flex');
    expect(row).toContain('align-items: center');
    expect(row).toContain('gap: var(--space-1)');
    expect(ruleFor(`${sel} > [data-boogy]`)).toContain('flex: none');
    expect(ruleFor(`${sel} > :not([data-boogy])`)).toContain('text-overflow: ellipsis');
  });
});

describe('a glyph before a title', () => {
  it('sits closer than a picture: --space-1 in a bar too, where an avatar keeps its wider gap', () => {
    const bar = '[data-boogy="top-bar"] > [data-slot="heading"] > [data-slot="title"]';
    expect(ruleFor(`${bar}:has(> :is([data-boogy="avatar"], [data-boogy="thumbnail"], [data-boogy="glyph"]))`)).toContain('gap: var(--space-2)');
    expect(ruleFor(`${bar}:has(> [data-boogy="glyph"])`)).toContain('gap: var(--space-1)');
  });
});

