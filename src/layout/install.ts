import { FOUNDATION_CSS } from './foundation-css';
import { COMPONENTS_CSS } from '../components/components-css';
import { FONTS_CSS } from './fonts-css';
import { findLayoutViolations } from './checks';

let sheet: CSSStyleSheet | null = null;
let watching = false;

export interface InstallOptions {
  /** Watch the document and warn about layout-rule violations. Dev builds only. */
  dev?: boolean;
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
