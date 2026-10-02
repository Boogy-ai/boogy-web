import { describe, it, expect } from 'vitest';
import { emptyState } from './empty-state';
import { ruleFor } from '../../test-support/rule-for';


describe('emptyState', () => {
  it('marks the region', () => {
    expect(emptyState()).toEqual({ 'data-boogy': 'empty-state' });
  });
  it('fills the space it is given and centres its content on both axes', () => {
    const r = ruleFor('[data-boogy="empty-state"]');
    expect(r).toContain('flex: 1 1 auto');
    expect(r).toContain('align-items: center');
    expect(r).toContain('justify-content: center');
    expect(r).toContain('text-align: center');
  });
  it('the graphic sits in a large accent disc', () => {
    const r = ruleFor('[data-boogy="empty-state"] > [data-slot="media"]');
    expect(r).toContain('width: var(--thumb-lg)');
    expect(r).toContain('height: var(--thumb-lg)');
    expect(r).toContain('border-radius: var(--radius-full)');
    expect(r).toContain('background: var(--accent-soft)');
    expect(r).toContain('color: var(--accent)');
  });
  it('a title over a dimmer line of explanation', () => {
    expect(ruleFor('[data-boogy="empty-state"] > [data-slot="title"]')).toContain('font-size: var(--fs-title)');
    expect(ruleFor('[data-boogy="empty-state"] > [data-slot="description"]')).toContain('color: var(--text-2)');
  });
});

describe('sheet title', () => {
  it("the head's title is a heading with no margin of its own, in the head's type", () => {
    const r = ruleFor('[data-boogy="sheet"] > [data-slot="head"] > [data-slot="title"]');
    expect(r).toContain('margin: 0');
    expect(r).toContain('font: inherit');
  });
});
