import { describe, it, expect, beforeEach, vi } from 'vitest';

// The store is page state: each test gets a fresh module, as a fresh page would.
async function fresh() {
  vi.resetModules();
  return import('./zoom');
}
const root = () => document.documentElement;

beforeEach(() => {
  document.querySelectorAll('base').forEach((b) => b.remove());
  localStorage.clear();
  root().removeAttribute('style');
  root().removeAttribute('data-zoom');
  history.replaceState(null, '', '/chats/c/1');
  vi.restoreAllMocks();
});

describe('the zoom store', () => {
  it('starts at 1 with nothing remembered, and draws nothing', async () => {
    const z = await fresh();
    z.initZoom();
    expect(z.zoomState()).toEqual({ zoom: 1, own: 1, host: 1, canZoomIn: true, canZoomOut: true });
    expect(root().style.getPropertyValue('--u-zoom')).toBe('');
    expect(root().hasAttribute('data-zoom')).toBe(false);
  });

  it('steps along the ladder and stops at each end', async () => {
    const z = await fresh();
    const seen: number[] = [];
    for (let i = 0; i < 7; i++) { z.zoomIn(); seen.push(z.zoomState().own); }
    expect(seen).toEqual([1.1, 1.25, 1.5, 1.75, 2, 2, 2]);
    expect(z.zoomState().canZoomIn).toBe(false);
    z.resetZoom();
    for (let i = 0; i < 4; i++) z.zoomOut();
    expect(z.zoomState().own).toBe(0.8);
    expect(z.zoomState().canZoomOut).toBe(false);
  });

  it('steps from a value off the ladder to the nearest step that way, and never the wrong way', async () => {
    const z = await fresh();
    expect(z.stepZoom(1.2, 1)).toBe(1.25);
    expect(z.stepZoom(1.2, -1)).toBe(1.1);
    expect(z.stepZoom(0.5, -1)).toBe(0.5);
    expect(z.stepZoom(3, 1)).toBe(3);
    expect(z.canStepZoom(0.5, -1)).toBe(false);
    expect(z.canStepZoom(0.5, 1)).toBe(true);
  });

  it('draws host × own on <html>, and marks a page that is not at 1', async () => {
    const z = await fresh();
    z.zoomIn();
    z.setHostZoom(1.5);
    expect(z.zoomState().zoom).toBeCloseTo(1.65);
    expect(Number(root().style.getPropertyValue('--u-zoom'))).toBeCloseTo(1.65);
    expect(root().hasAttribute('data-zoom')).toBe(true);
    z.clearHostZoom();
    z.resetZoom();
    expect(root().style.getPropertyValue('--u-zoom')).toBe('');
    expect(root().hasAttribute('data-zoom')).toBe(false);
  });

  it('refuses a host value that is not a finite number in [0.5, 3]', async () => {
    const z = await fresh();
    for (const bad of [Number.NaN, Infinity, -Infinity, 0.49, 3.01, 0, -1, '2', null, undefined]) {
      z.setHostZoom(bad as number);
      expect(z.zoomState().host, String(bad)).toBe(1);
    }
    z.setHostZoom(0.5);
    expect(z.zoomState().host).toBe(0.5);
    z.setHostZoom(3);
    expect(z.zoomState().host).toBe(3);
  });

  it("remembers the own value per app: the page's first path segment by default", async () => {
    let z = await fresh();
    z.zoomIn();
    z.zoomIn();
    expect(localStorage.getItem('boogy.zoom.v1:chats')).toBe('1.25');
    z = await fresh();
    z.initZoom();
    expect(z.zoomState().own).toBe(1.25);
    history.replaceState(null, '', '/notes/');
    z = await fresh();
    z.initZoom();
    expect(z.zoomState().own).toBe(1);
  });

  // The platform points <base href> at the app's mount, inside a versioned
  // asset prefix: `<mount>/_a/<content hash>/`.
  const withBase = (href: string) => {
    const b = document.createElement('base');
    b.href = href;
    document.head.append(b);
  };

  it("remembers under the app's mount, whichever route the page was opened on, and across a new build", async () => {
    withBase('/chats/_a/abc123/');
    history.replaceState(null, '', '/chats/c/1');
    let z = await fresh();
    z.zoomIn();
    expect(localStorage.getItem('boogy.zoom.v1:chats')).toBe('1.1');
    document.querySelectorAll('base').forEach((b) => b.remove());
    withBase('/chats/_a/def456/');
    history.replaceState(null, '', '/chats/add');
    z = await fresh();
    z.initZoom();
    expect(z.zoomState().own).toBe(1.1);
  });

  it('an app at the origin root (a custom domain) keeps one value across its routes', async () => {
    withBase('/_a/abc123/');
    history.replaceState(null, '', '/c/1');
    let z = await fresh();
    z.zoomIn();
    history.replaceState(null, '', '/');
    z = await fresh();
    z.initZoom();
    expect(z.zoomState().own).toBe(1.1);
  });

  it('rememberZoom(key) moves where the value lives and re-reads it; no key goes back to the default', async () => {
    const z = await fresh();
    localStorage.setItem('boogy.zoom.v1:board:a', '1.5');
    z.rememberZoom('board:a');
    expect(z.zoomState().own).toBe(1.5);
    z.zoomOut();
    expect(localStorage.getItem('boogy.zoom.v1:board:a')).toBe('1.25');
    z.rememberZoom();
    expect(z.zoomState().own).toBe(1);
  });

  it('a remembered value off the ladder, or garbage, reads as 1', async () => {
    for (const raw of ['1000', 'NaN', '', 'abc', '1.3', '-1']) {
      localStorage.setItem('boogy.zoom.v1:chats', raw);
      const z = await fresh();
      z.initZoom();
      expect(z.zoomState().own, JSON.stringify(raw)).toBe(1);
    }
  });

  it('storage that throws degrades to 1 and never breaks a step', async () => {
    const z = await fresh();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    z.initZoom();
    expect(z.zoomState().own).toBe(1);
    z.zoomIn();
    expect(z.zoomState().own).toBe(1.1);
  });

  it('tells every listener, and stops telling one that unsubscribed', async () => {
    const z = await fresh();
    const a = vi.fn();
    const off = z.onZoomChange(a);
    z.zoomIn();
    expect(a).toHaveBeenLastCalledWith(expect.objectContaining({ own: 1.1, zoom: 1.1 }));
    off();
    z.zoomIn();
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('installFoundation draws the remembered value from the start', async () => {
    localStorage.setItem('boogy.zoom.v1:chats', '1.5');
    vi.resetModules();
    vi.stubGlobal('CSSStyleSheet', class { replaceSync() {} });
    Object.defineProperty(document, 'adoptedStyleSheets', { configurable: true, writable: true, value: [] });
    const { installFoundation } = await import('./install');
    installFoundation();
    expect(root().style.getPropertyValue('--u-zoom')).toBe('1.5');
    vi.unstubAllGlobals();
  });
});
