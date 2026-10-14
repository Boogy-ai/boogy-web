import { describe, it, expect } from 'vitest';
import { sidePanel } from './side-panel';

describe('sidePanel()', () => {
  it('names the panel, docked by default', () => {
    expect(sidePanel()).toEqual({ 'data-boogy': 'side-panel' });
  });
  it('full: the whole window', () => {
    expect(sidePanel({ full: true })).toEqual({ 'data-boogy': 'side-panel', 'data-full': 'true' });
  });
  it('scrim: the page behind is dimmed', () => {
    expect(sidePanel({ scrim: true })).toEqual({ 'data-boogy': 'side-panel', 'data-scrim': 'true' });
  });
});
