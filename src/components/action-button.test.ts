import { describe, expect, it } from 'vitest';
import { ACTION_KINDS, ACTIONS, actionButton } from './action-button';
import { BUTTON_VARIANTS } from './button';
import { COMPONENTS_CSS } from './components-css';

describe('actions', () => {
  it('every kind is defined once: a label, what it says while busy, a look and a role', () => {
    for (const kind of ACTION_KINDS) {
      const a = ACTIONS[kind];
      expect(a, kind).toBeDefined();
      expect(a.label.length, kind).toBeGreaterThan(0);
      expect(a.busyLabel.length, kind).toBeGreaterThan(0);
      expect(BUTTON_VARIANTS, kind).toContain(a.variant);
      expect(['primary', 'secondary', 'destructive'], kind).toContain(a.role);
    }
  });

  it('the common ones read and look as people expect', () => {
    expect(ACTIONS.save).toMatchObject({ label: 'Save', busyLabel: 'Saving…', variant: 'solid', role: 'primary' });
    expect(ACTIONS.cancel).toMatchObject({ label: 'Cancel', variant: 'quiet', role: 'secondary' });
    expect(ACTIONS.delete).toMatchObject({ label: 'Delete', busyLabel: 'Deleting…', variant: 'danger', role: 'destructive', glyph: 'trash' });
    expect(ACTIONS.accept).toMatchObject({ label: 'Accept', variant: 'solid', role: 'primary' });
    // Every kind that runs says so differently from at rest.
    for (const kind of ['save', 'create', 'add', 'send', 'accept', 'confirm', 'done', 'upload', 'delete', 'remove', 'discard'] as const) {
      expect(ACTIONS[kind].busyLabel, kind).not.toBe(ACTIONS[kind].label);
    }
    expect(ACTIONS.add).toMatchObject({ label: 'Add', glyph: 'plus', role: 'primary' });
    expect(ACTIONS.upload).toMatchObject({ label: 'Upload', busyLabel: 'Uploading…', glyph: 'upload', role: 'secondary' });
  });

  it('accept and decline carry a check and a cross, so either reads as a glyph alone', () => {
    expect(ACTIONS.accept).toMatchObject({ label: 'Accept', glyph: 'check' });
    expect(ACTIONS.decline).toMatchObject({ label: 'Decline', glyph: 'close' });
  });

  it('archive sets a thing aside and unarchive brings it back: both quiet, archive first in a foot', () => {
    expect(ACTIONS.archive).toMatchObject({ label: 'Archive', busyLabel: 'Archiving…', variant: 'quiet', role: 'destructive', glyph: 'archive' });
    expect(ACTIONS.unarchive).toMatchObject({ label: 'Unarchive', busyLabel: 'Unarchiving…', variant: 'quiet', role: 'secondary', glyph: 'archive' });
  });

  it('names its kind and role on the element', () => {
    expect(actionButton('delete')).toEqual({ 'data-action': 'delete', 'data-role': 'destructive' });
    expect(() => actionButton('nope' as never)).toThrow(/kind/);
  });

  it('a destructive action goes first in a foot, the rest to its end', () => {
    expect(COMPONENTS_CSS).toMatch(/\[data-role="destructive"\][^{]*\{[^}]*order: -1/);
  });
});
