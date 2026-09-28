import { describe, it, expect, vi } from 'vitest';
import { findLayoutViolations } from './checks';

function dom(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('findLayoutViolations', () => {
  it('flags fluid on an element that is not a surface, naming the component', () => {
    const v = findLayoutViolations(dom('<div data-u-policy="fluid" data-component="IconRow"></div>'));
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe('fluid-needs-surface');
    expect(v[0].message).toContain('IconRow');
  });

  it('accepts fluid on a surface', () => {
    expect(findLayoutViolations(dom('<div data-surface="both" data-u-policy="fluid"></div>'))).toEqual([]);
  });

  it('ignores clamped and fixed', () => {
    expect(findLayoutViolations(dom('<div data-u-policy="clamped"></div><div data-u-policy="fixed"></div>'))).toEqual([]);
  });
});

describe('installFoundation({ dev: true })', () => {
  it('warns once per violating element as elements appear', async () => {
    vi.stubGlobal('CSSStyleSheet', class { replaceSync() {} });
    Object.defineProperty(document, 'adoptedStyleSheets', { configurable: true, value: [], writable: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { installFoundation } = await import('./install');
    installFoundation({ dev: true });
    const bad = document.createElement('div');
    bad.setAttribute('data-u-policy', 'fluid');
    document.body.appendChild(bad);
    await new Promise((r) => setTimeout(r, 0));
    document.body.appendChild(document.createElement('span')); // a second mutation
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    vi.unstubAllGlobals();
  });
});
