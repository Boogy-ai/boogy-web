// Markdown: what a person wrote in markdown, rendered. marked (GFM: tables,
// task lists, strikethrough; a single newline breaks the line, as chat does)
// parses it, and DOMPurify sanitises everything it produces to an ALLOWLIST of
// what GFM makes: no script, handler, frame, form, field, button, dialog,
// media, id, name, data- or aria- attribute, and a class only as code's
// language, so nothing a writer puts in runs, restyles or covers the page,
// fakes its controls, borrows its styles or clobbers its globals. Every input
// is a disabled checkbox (a task list). A link opens in a new tab sending
// nothing back; an image sends no referrer and loads only when near. Both are established
// libraries the host serves at /boogy/vendor/, loaded the first time markdown
// renders. A CodeBlock of markdown (```md) shows this as its Preview.
import { importVendor, vendorLoader } from './vendor-loader';

export const MARKED_PATH = '/boogy/vendor/marked-18.0.14.js';
export const DOMPURIFY_PATH = '/boogy/vendor/dompurify-3.4.16.js';

/** The names a fence gives markdown (compared ignoring case). */
export const MARKDOWN_LANGUAGES = ['md', 'markdown', 'mkd', 'mdown'] as const;

export function isMarkdown(language: string | null | undefined): boolean {
  return !!language && (MARKDOWN_LANGUAGES as readonly string[]).includes(language.toLowerCase());
}

export interface MarkdownAttrs {
  'data-boogy': 'markdown';
}

export function markdown(): MarkdownAttrs {
  return { 'data-boogy': 'markdown' };
}

/** Markdown in, sanitised HTML out. */
export type MarkdownRenderer = (markdown: string) => string;

/** What rendering needs of marked. */
export interface MarkdownParser {
  parse(src: string, options: { async: false; gfm: boolean; breaks: boolean }): string;
}

/** What rendering needs of DOMPurify. */
export interface HtmlSanitiser {
  /** Whether it can sanitise here; where it cannot it returns its input, so
   *  the renderer then shows the markdown as escaped text instead. */
  isSupported: boolean;
  sanitize(dirty: string, config: Record<string, unknown>): string;
  addHook(entry: 'afterSanitizeAttributes', hook: (node: Element) => void): void;
  addHook(entry: 'uponSanitizeAttribute', hook: (node: Element, data: { attrName: string; attrValue: string; keepAttr: boolean }) => void): void;
}

/** What GFM makes, and nothing else; anything outside it is dropped, its text
 *  kept. `target`, `rel`, `loading` and `referrerpolicy` are the hook's to
 *  set, never a writer's. */
const SANITISE = {
  ALLOWED_TAGS: [
    'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input',
  ],
  ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'start', 'align', 'type', 'checked', 'disabled', 'class'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
};

/** Each allowed attribute, on the tags GFM puts it on and no others (a
 *  `src` on an input, say, is dropped). */
const ATTRS_BY_TAG: Record<string, readonly string[]> = {
  A: ['href', 'title'],
  IMG: ['src', 'alt', 'title'],
  INPUT: ['type', 'checked', 'disabled'],
  OL: ['start'],
  TH: ['align'],
  TD: ['align'],
  CODE: ['class'],
};

/** A class may name only fenced code's language (`language-py`). */
const CODE_LANGUAGE_CLASS = /^language-[\w+#.-]+$/;

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** `text` as HTML that shows it as written, line by line. */
function asPlainText(text: string): string {
  return `<p>${text.replace(/[&<>"']/g, (c) => ESCAPES[c]).replace(/\n/g, '<br>')}</p>`;
}

/** A renderer over a parser and a sanitiser (the vendored ones, or a test's).
 *  Where the sanitiser cannot work, nothing the parser made reaches the page:
 *  the markdown shows as escaped text. */
export function markdownRenderer(parser: MarkdownParser, sanitiser: HtmlSanitiser): MarkdownRenderer {
  if (!sanitiser.isSupported) return asPlainText;
  sanitiser.addHook('uponSanitizeAttribute', (node, data) => {
    if (!(ATTRS_BY_TAG[node.tagName] ?? []).includes(data.attrName)) data.keepAttr = false;
    else if (data.attrName === 'class' && !CODE_LANGUAGE_CLASS.test(data.attrValue)) data.keepAttr = false;
  });
  sanitiser.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'INPUT') {
      node.setAttribute('type', 'checkbox');
      node.setAttribute('disabled', '');
    }
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
    if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy');
      node.setAttribute('referrerpolicy', 'no-referrer');
    }
  });
  return (src) => sanitiser.sanitize(parser.parse(src, { async: false, gfm: true, breaks: true }), SANITISE);
}

const renderer = vendorLoader<MarkdownRenderer>(async () => {
  const [{ marked }, { default: purify }] = await Promise.all([
    importVendor<{ marked: MarkdownParser }>(MARKED_PATH),
    importVendor<{ default: HtmlSanitiser }>(DOMPURIFY_PATH),
  ]);
  return markdownRenderer(marked, purify);
});

/** The renderer, loaded once for the page (by `load`, the host's by default). */
export function loadMarkdown(load?: () => Promise<MarkdownRenderer>): Promise<MarkdownRenderer> {
  return renderer.load(load);
}

/** The renderer, if the page has loaded it already. */
export function loadedMarkdown(): MarkdownRenderer | null {
  return renderer.loaded();
}
