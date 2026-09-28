import { describe, it, expect } from 'vitest';
import { drawerLayout, drawerItem, monogram } from './drawer';

describe('monogram', () => {
  it('takes the first letters of the first two words', () => {
    expect(monogram('Market Overview')).toBe('MO');
    expect(monogram('my  squad board')).toBe('MS');
  });
  it('takes the first two letters of a single word', () => {
    expect(monogram('Scratchpad')).toBe('Sc');
  });
  it('splits on hyphens, underscores and dots too', () => {
    expect(monogram('youtube-base')).toBe('YB');
  });
  it('is whole characters, not half an emoji or accent', () => {
    expect(monogram('Élan vital')).toBe('ÉV');
    expect(monogram('🚀 launch')).toBe('🚀L');
  });
  it('is empty for an empty label', () => {
    expect(monogram('   ')).toBe('');
  });
});

describe('drawerLayout', () => {
  it('defaults to start side, md breakpoint, expanded, closed', () => {
    expect(drawerLayout()).toEqual({
      'data-boogy': 'drawer-layout', 'data-side': 'start', 'data-collapse-at': 'md',
      'data-expanded': 'true', 'data-open': 'false',
    });
  });
  it('carries what it is given', () => {
    expect(drawerLayout({ side: 'end', collapseAt: 'lg', expanded: false, open: true })).toMatchObject({
      'data-side': 'end', 'data-collapse-at': 'lg', 'data-expanded': 'false', 'data-open': 'true',
    });
  });
  it('animates by default, and animate: false marks the layout to switch instantly', () => {
    expect(drawerLayout()).not.toHaveProperty('data-animate');
    expect(drawerLayout({ animate: false })).toMatchObject({ 'data-animate': 'false', 'data-expanded': 'true' });
  });
  it('refuses a breakpoint it has no styles for', () => {
    // @ts-expect-error — not a DrawerBreakpoint
    expect(() => drawerLayout({ collapseAt: 'xl' })).toThrow(/sm, md, lg/);
  });
});

describe('drawerItem', () => {
  it('marks the current entry for assistive technology, and nothing otherwise', () => {
    expect(drawerItem({ current: true })).toEqual({ 'data-boogy': 'drawer-item', 'data-variant': 'entry', 'aria-current': 'page' });
    expect(drawerItem()).toEqual({ 'data-boogy': 'drawer-item', 'data-variant': 'entry' });
  });
});

describe('drawerItem variants', () => {
  it('is the entry variant by default and carries title when asked', () => {
    expect(drawerItem()['data-variant']).toBe('entry');
    expect(drawerItem({ variant: 'title' })['data-variant']).toBe('title');
    expect(drawerItem({ variant: 'framed' })['data-variant']).toBe('framed');
  });
  it('refuses a variant it has no styles for', () => {
    // @ts-expect-error — not a DrawerItemVariant
    expect(() => drawerItem({ variant: 'huge' })).toThrow(/entry, title, framed/);
  });
});
