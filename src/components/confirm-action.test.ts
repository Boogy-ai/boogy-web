import { describe, it, expect } from 'vitest';
import { confirmAction } from './confirm-action';
import { ruleFor } from '../../test-support/rule-for';

describe('confirmAction', () => {
  it('marks the control, and whether it is asking', () => {
    expect(confirmAction()).toEqual({ 'data-boogy': 'confirm-action' });
    expect(confirmAction({ asking: true })).toEqual({ 'data-boogy': 'confirm-action', 'data-asking': '' });
  });
  it('asks in a row, on one line, its question in the caption', () => {
    const r = ruleFor('[data-boogy="confirm-action"]');
    expect(r).toMatch(/display:\s*inline-flex/);
    expect(r).toMatch(/align-items:\s*center/);
    expect(r).toMatch(/gap:\s*var\(--space-1\)/);
    expect(ruleFor('[data-boogy="confirm-action"] > [data-slot="question"]')).toMatch(/font-size:\s*var\(--fs-caption\)/);
  });
});

describe('pagedListEnd', () => {
  it('centres its trigger under the list', () => {
    expect(ruleFor('[data-boogy="paged-list-end"]')).toMatch(/justify-content:\s*center/);
  });
});
