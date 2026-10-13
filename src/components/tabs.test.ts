import { describe, it, expect } from 'vitest';
import { tab, tabKey, tabs, tabList, tabPanel, tabId, tabRowMore, tabRowWheel } from './tabs';

describe('tabs', () => {
  it('marks the root', () => {
    expect(tabs()).toEqual({ 'data-boogy': 'tabs' });
  });
  it('the row of tabs is a tablist; fill: its tabs share it evenly', () => {
    expect(tabList()).toEqual({ 'data-boogy': 'tab-list', role: 'tablist' });
    expect(tabList({ fill: true })).toEqual({ 'data-boogy': 'tab-list', role: 'tablist', 'data-fill': 'true' });
  });
  it('edge: a row below what it controls runs its lines along its top; the bottom is the default and needs no mark', () => {
    expect(tabList({ edge: 'top' })).toEqual({ 'data-boogy': 'tab-list', role: 'tablist', 'data-edge': 'top' });
    expect(tabList({ edge: 'bottom' })).toEqual({ 'data-boogy': 'tab-list', role: 'tablist' });
    expect(tabList({ fill: true, edge: 'top' })).toEqual({ 'data-boogy': 'tab-list', role: 'tablist', 'data-fill': 'true', 'data-edge': 'top' });
  });
  it('a panel shown apart from its row is a tabpanel; a tab is found from its panel', () => {
    expect(tabPanel()).toEqual({ 'data-boogy': 'tab-panel', role: 'tabpanel' });
    expect(tabId('home', 'buddies')).toBe('home--buddies');
  });
  it('a tab is a button that says whether it is selected, and only the selected one is a tab stop', () => {
    expect(tab({ selected: true })).toEqual({ 'data-slot': 'tab', role: 'tab', type: 'button', 'aria-selected': 'true', tabIndex: 0 });
    expect(tab({ selected: false })).toEqual({ 'data-slot': 'tab', role: 'tab', type: 'button', 'aria-selected': 'false', tabIndex: -1 });
  });
});

describe('tabKey', () => {
  it('arrows step through the tabs, wrapping at either end', () => {
    expect(tabKey('ArrowRight', 0, 3)).toBe(1);
    expect(tabKey('ArrowRight', 2, 3)).toBe(0);
    expect(tabKey('ArrowLeft', 0, 3)).toBe(2);
  });
  it('Home and End go to the ends', () => {
    expect(tabKey('Home', 2, 3)).toBe(0);
    expect(tabKey('End', 0, 3)).toBe(2);
  });
  it('any other key is not the tabs\' to handle', () => {
    expect(tabKey('Enter', 1, 3)).toBeNull();
    expect(tabKey('ArrowDown', 1, 3)).toBeNull();
  });
  it('a row of tabs has more to a side when it is scrolled short of that end (a pixel of rounding aside)', () => {
    expect(tabRowMore(0, 300, 300)).toEqual({ left: false, right: false });
    expect(tabRowMore(0, 300, 800)).toEqual({ left: false, right: true });
    expect(tabRowMore(200, 300, 800)).toEqual({ left: true, right: true });
    expect(tabRowMore(500, 300, 800)).toEqual({ left: true, right: false });
    expect(tabRowMore(499.5, 300, 800)).toEqual({ left: true, right: false });
    expect(tabRowMore(0.5, 300, 800)).toEqual({ left: false, right: true });
  });
  it('a mouse wheel turned up or down moves a row that does not fit sideways, in pixels', () => {
    const row = { scrollLeft: 200, clientWidth: 300, scrollWidth: 800 };
    expect(tabRowWheel({ deltaX: 0, deltaY: 100, deltaMode: 0 }, row, 16)).toBe(100);
    expect(tabRowWheel({ deltaX: 0, deltaY: -100, deltaMode: 0 }, row, 16)).toBe(-100);
    expect(tabRowWheel({ deltaX: 0, deltaY: 3, deltaMode: 1 }, row, 16)).toBe(48);
    expect(tabRowWheel({ deltaX: 0, deltaY: 1, deltaMode: 2 }, row, 16)).toBe(300);
  });
  it('a wheel turn is not the row\'s when it is sideways, the row fits, or the row is at that end', () => {
    expect(tabRowWheel({ deltaX: 50, deltaY: 20, deltaMode: 0 }, { scrollLeft: 200, clientWidth: 300, scrollWidth: 800 }, 16)).toBeNull();
    expect(tabRowWheel({ deltaX: 0, deltaY: 100, deltaMode: 0 }, { scrollLeft: 0, clientWidth: 300, scrollWidth: 300 }, 16)).toBeNull();
    expect(tabRowWheel({ deltaX: 0, deltaY: 100, deltaMode: 0 }, { scrollLeft: 500, clientWidth: 300, scrollWidth: 800 }, 16)).toBeNull();
    expect(tabRowWheel({ deltaX: 0, deltaY: -100, deltaMode: 0 }, { scrollLeft: 0, clientWidth: 300, scrollWidth: 800 }, 16)).toBeNull();
  });
});
