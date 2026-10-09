import { describe, it, expect } from 'vitest';
import { menuItem, menuItemText, moveFocus, typeahead, typeaheadSearch, TYPEAHEAD_RESET_MS } from './menu';

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

describe('typeaheadSearch', () => {
  const press = (key: string, more: Partial<KeyboardEventInit> = {}, target: EventTarget | null = null) =>
    ({ key, ctrlKey: false, metaKey: false, altKey: false, target, ...more });
  const none = { text: '', at: 0 };

  it('a typed character starts a search, and the next one in quick succession adds to it', () => {
    const a = typeaheadSearch(none, press('d'), 5000);
    expect(a).toEqual({ text: 'd', at: 5000 });
    expect(typeaheadSearch(a!, press('e'), 5000 + TYPEAHEAD_RESET_MS)).toEqual({ text: 'de', at: 5000 + TYPEAHEAD_RESET_MS });
  });

  it('a pause starts a new search', () => {
    expect(typeaheadSearch({ text: 'de', at: 5000 }, press('p'), 5001 + TYPEAHEAD_RESET_MS)).toEqual({ text: 'p', at: 5001 + TYPEAHEAD_RESET_MS });
  });

  it('a space continues a running search, and otherwise is no part of one: it presses the item', () => {
    expect(typeaheadSearch(none, press(' '), 5000)).toBeNull();
    expect(typeaheadSearch({ text: 'invite', at: 5000 }, press(' '), 5100)).toEqual({ text: 'invite ', at: 5100 });
    expect(typeaheadSearch({ text: 'invite', at: 5000 }, press(' '), 5001 + TYPEAHEAD_RESET_MS)).toBeNull();
  });

  it('a key that types nothing, or one with a modifier, is no part of a search', () => {
    expect(typeaheadSearch(none, press('ArrowDown'), 5000)).toBeNull();
    expect(typeaheadSearch(none, press('c', { ctrlKey: true }), 5000)).toBeNull();
    expect(typeaheadSearch(none, press('c', { metaKey: true }), 5000)).toBeNull();
    expect(typeaheadSearch(none, press('c', { altKey: true }), 5000)).toBeNull();
  });

  it('typing in a field is the field\'s', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      expect(typeaheadSearch(none, press('c', {}, document.createElement(tag)), 5000)).toBeNull();
    }
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    expect(typeaheadSearch(none, press('c', {}, editable), 5000)).toBeNull();
    expect(typeaheadSearch(none, press('c', {}, document.createElement('button')), 5000)).toEqual({ text: 'c', at: 5000 });
  });
});

describe('menuItemText', () => {
  it('is the text the item gives for typeahead, else its label, else all its text', () => {
    const item = (html: string, textValue?: string) => {
      const el = document.createElement('div');
      el.innerHTML = html;
      if (textValue) el.dataset.textValue = textValue;
      return el;
    };
    expect(menuItemText(item('<span data-slot="label">Delete</span><span data-slot="description">Cannot be undone</span>', 'Remove'))).toBe('Remove');
    expect(menuItemText(item('<span data-slot="label">Delete</span><span data-slot="description">Cannot be undone</span>'))).toBe('Delete');
    expect(menuItemText(item('Copy'))).toBe('Copy');
  });
});
