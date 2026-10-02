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

describe('installFoundation scale', () => {
  const root = () => document.documentElement;
  const reset = () => {
    for (const a of ['data-u-axis', 'data-u-policy', 'data-component']) root().removeAttribute(a);
    root().removeAttribute('style');
  };
  it('is off by default: the page keeps the fixed base size', async () => {
    reset();
    const { installFoundation } = await import('./install');
    installFoundation();
    expect(root().hasAttribute('data-u-policy')).toBe(false);
  });
  it('scale: true — the whole page follows its viewport, between the default floor and cap', async () => {
    reset();
    const { installFoundation } = await import('./install');
    const { DEFAULT_SCALE } = await import('./scale');
    installFoundation({ scale: true });
    expect(root().getAttribute('data-u-axis')).toBe(DEFAULT_SCALE.axis);
    expect(root().getAttribute('data-u-policy')).toBe(DEFAULT_SCALE.policy);
    expect(root().style.getPropertyValue('--u-factor')).toBe(String(DEFAULT_SCALE.factor));
    expect(root().style.getPropertyValue('--u-floor')).toBe(DEFAULT_SCALE.floor);
    expect(root().style.getPropertyValue('--u-cap')).toBe(DEFAULT_SCALE.cap);
    reset();
  });
  it('a Scale overrides the default per field', async () => {
    reset();
    const { installFoundation } = await import('./install');
    installFoundation({ scale: { cap: '1.25rem' } });
    expect(root().style.getPropertyValue('--u-cap')).toBe('1.25rem');
    expect(root().getAttribute('data-u-policy')).toBe('clamped');
    reset();
  });
});

describe('FOUNDATION_CSS', () => {
  it('a scaled page sizes its plain text from the scale too', () => {
    expect(FOUNDATION_CSS).toMatch(/:root:is\(\[data-u-policy\], \[data-zoom\]\) > body \{ font-size: var\(--fs-body\); \}/);
  });
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
