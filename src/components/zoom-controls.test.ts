import { describe, it, expect } from 'vitest';
import { zoomControls } from './zoom-controls';
import { ruleFor } from '../../test-support/rule-for';

describe('zoomControls', () => {
  it('is a named group', () => {
    expect(zoomControls()).toEqual({ 'data-boogy': 'zoom-controls', role: 'group' });
  });
  it('lays its buttons out in a row, a token apart, and sizes each letter from a text token', () => {
    expect(ruleFor('[data-boogy="zoom-controls"]')).toMatch(/display: inline-flex[\s\S]*gap: var\(--space-\d\)/);
    expect(ruleFor('[data-boogy="zoom-controls"] [data-slot="smaller"] > [data-slot="letter"]')).toMatch(/font-size: var\(--fs-caption\)/);
    expect(ruleFor('[data-boogy="zoom-controls"] [data-slot="larger"] > [data-slot="letter"]')).toMatch(/font-size: var\(--fs-title\)/);
  });
});
