import { describe, it, expect } from 'vitest';
import { zoomControls } from './zoom-controls';
import { ruleFor } from '../../test-support/rule-for';
import { COMPONENTS_CSS as componentsCss } from './components-css';

describe('zoomControls', () => {
  it('is a named group', () => {
    expect(zoomControls()).toEqual({ 'data-boogy': 'zoom-controls', role: 'group' });
  });
  it('lays its buttons out in a row, a token apart, and styles no letter: its glyphs are the SDK\'s', () => {
    expect(ruleFor('[data-boogy="zoom-controls"]')).toMatch(/display: inline-flex[\s\S]*gap: var\(--space-\d\)/);
    expect(componentsCss).not.toContain('data-slot="letter"');
  });
});
