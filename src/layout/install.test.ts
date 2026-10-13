import { describe, it, expect, vi } from 'vitest';
import { FOUNDATION_CSS } from './foundation-css';
import { COMPONENTS_CSS } from '../components/components-css';
import { FONTS_CSS } from './fonts-css';
import { blockOf, ruleIn } from '../../test-support/rule-for';

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
  it('is on by default: the whole page follows its viewport', async () => {
    reset();
    const { installFoundation } = await import('./install');
    const { DEFAULT_SCALE } = await import('./scale');
    installFoundation();
    expect(root().getAttribute('data-u-policy')).toBe(DEFAULT_SCALE.policy);
    reset();
  });
  it('in dev, turning the page scale off says so', async () => {
    reset();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { installFoundation } = await import('./install');
    installFoundation({ dev: true, scale: false });
    expect(warn.mock.calls.some((c) => String(c[0]).includes('page scale is off'))).toBe(true);
    warn.mockRestore();
  });
  it('scale: false keeps the fixed base size', async () => {
    reset();
    const { installFoundation } = await import('./install');
    installFoundation({ scale: false });
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
  it('sizes follow the container, never the viewport: its one media query is the touch capability', () => {
    expect(FOUNDATION_CSS.match(/@media[^{]*/g)).toEqual(['@media (pointer: coarse) ']);
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

/** The value a rule body gives `prop` (`--u` is not `--u-inline`). */
const valueOf = (body: string, prop: string) => new RegExp(`(?:^|[\\s{;])${prop}:\\s*([^;]+);`).exec(body)?.[1].trim();

describe('FOUNDATION_CSS on a touch screen', () => {
  it('the reading floor is none by default and the reader\'s text size under a coarse pointer', () => {
    expect(valueOf(ruleIn(FOUNDATION_CSS, ':root'), '--u-reading-floor')).toBe('0rem');
    const coarse = blockOf(FOUNDATION_CSS, '@media (pointer: coarse)');
    expect(valueOf(ruleIn(coarse, ':root'), '--u-reading-floor')).toBe('1rem');
  });

  it('every clamped and fluid unit floors at the larger of the scale\'s floor and the reading floor', () => {
    const clamped = ruleIn(FOUNDATION_CSS, '[data-u-policy="clamped"]');
    const fluid = ruleIn(FOUNDATION_CSS, '[data-u-policy="fluid"]');
    for (const p of ['--u', '--u-inline', '--u-block']) {
      expect(valueOf(clamped, p), p).toMatch(/^calc\(clamp\(max\(var\(--u-floor\), var\(--u-reading-floor\)\), /);
      expect(valueOf(fluid, p), p).toMatch(/^calc\(max\(var\(--u-floor\), var\(--u-reading-floor\), /);
    }
  });

  it('a glyph on a touch target is half the touch minimum', () => {
    expect(valueOf(ruleIn(FOUNDATION_CSS, ':root'), '--icon-touch')).toBe('calc(var(--touch-min) / 2)');
  });
});

describe('FOUNDATION_CSS accent', () => {
  it('an element with an accent of its own re-derives exactly the accent tokens the root derives', () => {
    const decls = (body: string) => Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
    const derived = Object.fromEntries(Object.entries(decls(ruleIn(FOUNDATION_CSS, ':root'))).filter(([, v]) => v.includes('var(--accent)')));
    expect(Object.keys(derived)).toEqual(expect.arrayContaining(['--accent-hover', '--accent-soft', '--ring-color']));
    expect(decls(ruleIn(FOUNDATION_CSS, '[data-accent]'))).toEqual(derived);
  });
});
