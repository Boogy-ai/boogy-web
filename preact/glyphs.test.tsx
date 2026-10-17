import { describe, it, expect } from 'vitest';
import { render } from 'preact';
import { Glyph } from './index';

describe('<Glyph>', () => {
  it('sidebar: a frame with a column down its start side, for showing or hiding a side panel', () => {
    const r = document.createElement('div');
    render(<Glyph shape="sidebar" />, r);
    expect([...r.querySelectorAll('path')].map((p) => p.getAttribute('d'))).toEqual(['M4 5h16v14H4z', 'M9.5 5v14']);
  });
});

describe('<Glyph> settings and archive', () => {
  it('settings is a cog; archive a box with a lid', () => {
    for (const shape of ['settings', 'archive'] as const) {
      const r = document.createElement('div');
      render(<Glyph shape={shape} />, r);
      expect(r.querySelectorAll('path').length, shape).toBeGreaterThan(1);
    }
  });
});

describe('<Glyph> hash', () => {
  it('hash: two rungs across two leaning rails, as a channel is marked', () => {
    const r = document.createElement('div');
    render(<Glyph shape="hash" />, r);
    expect(r.querySelectorAll('path').length).toBe(4);
  });
});
