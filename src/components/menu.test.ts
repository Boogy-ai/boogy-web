import { describe, it, expect } from 'vitest';
import { menuItem, moveFocus, typeahead } from './menu';

describe('menuItem()', () => {
  it('takes the role its selection mode calls for, as React Aria does', () => {
    expect(menuItem({ id: 'a', selectionMode: 'none' }).role).toBe('menuitem');
    expect(menuItem({ id: 'a', selectionMode: 'single' }).role).toBe('menuitemradio');
    expect(menuItem({ id: 'a', selectionMode: 'multiple' }).role).toBe('menuitemcheckbox');
  });

  it('says whether it is checked only when it can be', () => {
    expect(menuItem({ id: 'a', selectionMode: 'none', selected: true })).not.toHaveProperty('aria-checked');
    expect(menuItem({ id: 'a', selectionMode: 'single', selected: true })['aria-checked']).toBe('true');
    expect(menuItem({ id: 'a', selectionMode: 'multiple', selected: false })['aria-checked']).toBe('false');
  });

  it('marks its key, variant, selection and disabled state for styling', () => {
    expect(menuItem({ id: 'rm', selectionMode: 'single', selected: true, disabled: true, variant: 'danger' })).toMatchObject({
      'data-boogy': 'menu-item', 'data-key': 'rm', 'data-variant': 'danger',
      'data-selected': 'true', 'data-disabled': 'true', 'aria-disabled': 'true', tabIndex: -1,
    });
    const plain = menuItem({ id: 'a', selectionMode: 'none' });
    expect(plain['data-variant']).toBe('default');
    expect(plain).not.toHaveProperty('data-selected');
    expect(plain).not.toHaveProperty('data-disabled');
  });

  it('refuses a variant it has no styles for', () => {
    // @ts-expect-error — not a MenuItemVariant
    expect(() => menuItem({ id: 'a', selectionMode: 'none', variant: 'loud' })).toThrow(/default, danger/);
  });
});

describe('moveFocus', () => {
  it('arrows step one; Home and End jump to the ends', () => {
    expect(moveFocus('ArrowDown', 1, 4, false)).toBe(2);
    expect(moveFocus('ArrowUp', 1, 4, false)).toBe(0);
    expect(moveFocus('Home', 2, 4, false)).toBe(0);
    expect(moveFocus('End', 0, 4, false)).toBe(3);
  });

  it('stops at the ends unless wrapping (React Aria\'s shouldFocusWrap, default off)', () => {
    expect(moveFocus('ArrowDown', 3, 4, false)).toBe(3);
    expect(moveFocus('ArrowUp', 0, 4, false)).toBe(0);
    expect(moveFocus('ArrowDown', 3, 4, true)).toBe(0);
    expect(moveFocus('ArrowUp', 0, 4, true)).toBe(3);
  });

  it('from nothing focused, down goes to the first and up to the last', () => {
    expect(moveFocus('ArrowDown', -1, 4, false)).toBe(0);
    expect(moveFocus('ArrowUp', -1, 4, false)).toBe(3);
  });

  it('ignores other keys and empty menus', () => {
    expect(moveFocus('a', 1, 4, false)).toBeNull();
    expect(moveFocus('ArrowDown', -1, 0, false)).toBeNull();
  });
});

describe('typeahead', () => {
  const labels = ['Copy', 'Cut', 'Paste', 'Delete', 'Duplicate'];

  it('finds the next item whose text starts with what was typed, after the current one', () => {
    expect(typeahead(labels, 'd', 0)).toBe(3);
    expect(typeahead(labels, 'd', 3)).toBe(4);
  });

  it('wraps round to the start, and matches the whole typed prefix case-insensitively', () => {
    expect(typeahead(labels, 'c', 4)).toBe(0);
    expect(typeahead(labels, 'CU', 0)).toBe(1);
  });

  it('keeps the current item when a longer prefix still matches it', () => {
    expect(typeahead(labels, 'de', 3)).toBe(3);
  });

  it('returns null when nothing matches', () => {
    expect(typeahead(labels, 'z', 0)).toBeNull();
    expect(typeahead(labels, '', 0)).toBeNull();
  });
});
