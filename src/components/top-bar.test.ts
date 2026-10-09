import { describe, it, expect } from 'vitest';
import { fitTopBar, menuRows, moveInRows, topBar, type BarItemFit } from './top-bar';

const item = (id: string, priority: number, width: number, place: BarItemFit['place'] = 'auto'): BarItemFit => ({ id, priority, width, place });
// Edit 50 (1), Links 70 (1), Present 60 (2), Close 60 (3), Delete 60 (4); the More button is 30; gaps 10.
const ITEMS = [item('edit', 1, 50), item('links', 1, 70), item('present', 2, 60), item('close', 3, 60), item('delete', 4, 60)];
const ids = (s: Set<string>) => [...s].sort();

describe('topBar', () => {
  it('marks the element', () => {
    expect(topBar()).toEqual({ 'data-boogy': 'top-bar' });
  });
});

describe('fitTopBar', () => {
  it('keeps every item when all fit and nothing must go to the menu', () => {
    // 50+70+60+60+60 = 300, plus 4 gaps of 10.
    expect(ids(fitTopBar(ITEMS, 340, 30, 10))).toEqual(['close', 'delete', 'edit', 'links', 'present']);
  });

  it('as the bar narrows, the lowest priority leaves first, and the More button takes its room', () => {
    // 339 no longer fits all five; with More (30, and its gap) Delete leaves.
    expect(ids(fitTopBar(ITEMS, 339, 30, 10))).toEqual(['close', 'edit', 'links', 'present']);
    expect(ids(fitTopBar(ITEMS, 250, 30, 10))).toEqual(['edit', 'links', 'present']);
    expect(ids(fitTopBar(ITEMS, 169, 30, 10))).toEqual(['edit']);
    expect(ids(fitTopBar(ITEMS, 100, 30, 10))).toEqual(['edit']);
    expect(ids(fitTopBar(ITEMS, 60, 30, 10))).toEqual([]);
  });

  it('as it widens, they come back in the same order', () => {
    const shown = [100, 170, 240, 310, 340].map((w) => fitTopBar(ITEMS, w, 30, 10).size);
    expect(shown).toEqual([1, 2, 3, 4, 5]);
  });

  it('of one priority, the later item leaves first', () => {
    expect(ids(fitTopBar([item('a', 1, 50), item('b', 1, 50)], 100, 30, 10))).toEqual(['a']);
  });

  it('a lower priority never stays in place of a higher one that did not fit', () => {
    // Present (60) does not fit after Edit and Links; Close is smaller but lower: it goes too.
    const small = [item('edit', 1, 50), item('links', 1, 70), item('present', 2, 60), item('close', 3, 20)];
    expect(ids(fitTopBar(small, 200, 30, 10))).toEqual(['edit', 'links']);
  });

  it("a 'menu' item always goes, so the More button is reserved even when every other item would fit", () => {
    const withWidget = [...ITEMS, item('size', 9, 80, 'menu')];
    expect(ids(fitTopBar(withWidget, 1000, 30, 10))).toEqual(['close', 'delete', 'edit', 'links', 'present']);
    // 300, 4 gaps between them, a gap and More: 380. 379 no longer holds Delete.
    expect(ids(fitTopBar(withWidget, 380, 30, 10))).toEqual(['close', 'delete', 'edit', 'links', 'present']);
    expect(ids(fitTopBar(withWidget, 379, 30, 10))).toEqual(['close', 'edit', 'links', 'present']);
  });

  it("a 'bar' item always stays, whatever fits", () => {
    expect(ids(fitTopBar([item('size', 9, 80, 'bar'), ...ITEMS], 50, 30, 10))).toEqual(['size']);
  });
});

describe('menuRows', () => {
  it('lists what is not in the bar, most important first, then in the caller order', () => {
    const all = [...ITEMS, item('size', 9, 80, 'menu')];
    expect(menuRows(all, new Set(['edit', 'links']))).toEqual(['present', 'close', 'delete', 'size']);
  });
});

describe('moveInRows', () => {
  // A plain item, a row of two controls (Smaller, Larger), a plain item.
  const rows = [1, 2, 1];
  it('Up and Down move between rows, to a row\'s first control, wrapping at the ends; Home and End to the ends', () => {
    expect(moveInRows('ArrowDown', false, { row: 0, col: 0 }, rows)).toEqual({ row: 1, col: 0 });
    expect(moveInRows('ArrowDown', false, { row: 1, col: 1 }, rows)).toEqual({ row: 2, col: 0 });
    expect(moveInRows('ArrowUp', false, { row: 2, col: 0 }, rows)).toEqual({ row: 1, col: 0 });
    expect(moveInRows('ArrowDown', false, { row: 2, col: 0 }, rows)).toEqual({ row: 0, col: 0 });
    expect(moveInRows('ArrowUp', false, { row: 0, col: 0 }, rows)).toEqual({ row: 2, col: 0 });
    expect(moveInRows('Home', false, { row: 2, col: 0 }, rows)).toEqual({ row: 0, col: 0 });
    expect(moveInRows('End', false, { row: 0, col: 0 }, rows)).toEqual({ row: 2, col: 0 });
    expect(moveInRows('ArrowDown', false, { row: -1, col: 0 }, rows)).toEqual({ row: 0, col: 0 });
  });
  it('Left and Right move within a row of controls, stopping at its ends', () => {
    expect(moveInRows('ArrowRight', false, { row: 1, col: 0 }, rows)).toEqual({ row: 1, col: 1 });
    expect(moveInRows('ArrowRight', false, { row: 1, col: 1 }, rows)).toEqual({ row: 1, col: 1 });
    expect(moveInRows('ArrowLeft', false, { row: 1, col: 1 }, rows)).toEqual({ row: 1, col: 0 });
  });
  it('Tab reaches the next control in a row; past its last, or on a plain item, it closes the menu', () => {
    expect(moveInRows('Tab', false, { row: 1, col: 0 }, rows)).toEqual({ row: 1, col: 1 });
    expect(moveInRows('Tab', false, { row: 1, col: 1 }, rows)).toBe('close');
    expect(moveInRows('Tab', true, { row: 1, col: 1 }, rows)).toEqual({ row: 1, col: 0 });
    expect(moveInRows('Tab', true, { row: 1, col: 0 }, rows)).toBe('close');
    expect(moveInRows('Tab', false, { row: 0, col: 0 }, rows)).toBe('close');
  });
  it('any other key is not the menu\'s', () => {
    expect(moveInRows('a', false, { row: 0, col: 0 }, rows)).toBeNull();
  });
});
