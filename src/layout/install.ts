import { FOUNDATION_CSS } from './foundation-css';
import { COMPONENTS_CSS } from '../components/components-css';
import { FONTS_CSS } from './fonts-css';
import { findLayoutViolations } from './checks';
import { scale as scaleAttrs, type Scale } from './scale';
import { initZoom } from './zoom';

let sheet: CSSStyleSheet | null = null;
let watching = false;

export interface InstallOptions {
  /** Watch the document and warn about layout-rule violations. Dev builds only. */
  dev?: boolean;
  /**
   * Scale the whole page with its viewport: the root size unit, and with it
   * every component, size token and plain text, follows the viewport between a
   * floor and a cap. `true` takes the SDK's default scale; a `Scale` overrides
   * it per field. Off by default (the page keeps the fixed base size). Suits a
   * page embedded in a frame of varying size, whose viewport IS the frame.
   */
  scale?: boolean | Scale;
}

/**
 * Install the foundation stylesheet once per document. Safe to call from
 * every entry point; later calls are no-ops for the stylesheet.
 */
export function installFoundation(opts: InstallOptions = {}): void {
  if (typeof document === 'undefined') return;
  if (!sheet) {
    sheet = new CSSStyleSheet();
    // Layer order first, so components always sit above the foundation.
    sheet.replaceSync(`@layer boogy.foundation, boogy.components;\n${FONTS_CSS}\n${FOUNDATION_CSS}\n${COMPONENTS_CSS}`);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
  // The page's remembered zoom, before the first paint.
  initZoom();
  if (opts.scale) applyRootScale(opts.scale === true ? {} : opts.scale);
  if (opts.dev && !watching) {
    watching = true;
    const warned = new WeakSet<Element>();
    const scan = () => {
      for (const v of findLayoutViolations(document)) {
        if (warned.has(v.element)) continue;
        warned.add(v.element);
        console.warn(`[@boogy/web] ${v.message}`, v.element);
      }
    };
    scan();
    new MutationObserver(scan).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-u-policy', 'data-surface'],
    });
  }
}

/** The page's own unit: scale()'s attributes on <html>. With no container
 *  above it, its container units resolve against the viewport. */
function applyRootScale(s: Scale): void {
  const root = document.documentElement;
  const { style, ...attrs } = scaleAttrs(s);
  for (const [name, value] of Object.entries(attrs)) root.setAttribute(name, value as string);
  for (const [name, value] of Object.entries(style)) root.style.setProperty(name, value);
}
