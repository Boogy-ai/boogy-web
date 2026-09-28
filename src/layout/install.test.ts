import { describe, it, expect, vi } from 'vitest';
import { FOUNDATION_CSS } from './foundation-css';
import { COMPONENTS_CSS } from '../components/components-css';
import { FONTS_CSS } from './fonts-css';

describe('installFoundation', () => {
  it('adopts the stylesheet exactly once', async () => {
    const adopted: unknown[] = [];
    const replaceSync = vi.fn();
    vi.stubGlobal('CSSStyleSheet', class { replaceSync = replaceSync; });
    Object.defineProperty(document, 'adoptedStyleSheets', {
      configurable: true,
      get: () => adopted,
      set: (v: unknown[]) => { adopted.splice(0, adopted.length, ...v); },
    });
    const { installFoundation } = await import('./install');
    installFoundation();
    installFoundation();
    expect(adopted).toHaveLength(1);
    const css = replaceSync.mock.calls[0][0] as string;
    expect(css.startsWith('@layer boogy.foundation, boogy.components;')).toBe(true);
    expect(css).toContain(FOUNDATION_CSS);
    expect(css).toContain(COMPONENTS_CSS);
    expect(css).toContain(FONTS_CSS);
    vi.unstubAllGlobals();
  });
});

describe('FOUNDATION_CSS', () => {
  it('contains no media query', () => {
    expect(FOUNDATION_CSS).not.toMatch(/@media/);
  });
  it('never spells a square root as sqrt(pow(', () => {
    expect(FOUNDATION_CSS).not.toMatch(/sqrt\s*\(\s*pow/);
  });
  it('registers the three units', () => {
    for (const p of ['--u', '--u-inline', '--u-block']) {
      expect(FOUNDATION_CSS).toContain(`@property ${p} {`);
    }
  });
});
