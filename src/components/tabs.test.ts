import { describe, it, expect } from 'vitest';
import { tab, tabKey, tabs, tabList, tabPanel, tabId } from './tabs';

describe('tabs', () => {
  it('marks the root', () => {
    expect(tabs()).toEqual({ 'data-boogy': 'tabs' });
  });
  it('the row of tabs is a tablist; fill: its tabs share it evenly', () => {
    expect(tabList()).toEqual({ 'data-boogy': 'tab-list', role: 'tablist' });
    expect(tabList({ fill: true })).toEqual({ 'data-boogy': 'tab-list', role: 'tablist', 'data-fill': 'true' });
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
});
