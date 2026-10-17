// What the renderer does with whatever parser and sanitiser it is given. The
// sanitising itself is DOMPurify's, tested in a real browser
// (test-browser/markdown.browser.test.ts): this test DOM does not parse HTML
// faithfully enough for DOMPurify.
import { describe, it, expect, vi } from 'vitest';
import { isMarkdown, markdown, markdownRenderer, type HtmlSanitiser, type MarkdownParser } from './markdown';

const parser: MarkdownParser = { parse: (src) => `<p>${src}</p>` };
type Hook = (node: Element, data?: { attrName: string; attrValue: string; keepAttr: boolean }) => void;
function sanitiser(isSupported = true) {
  const hooks: Record<string, Hook> = {};
  const s: HtmlSanitiser & { hooks: typeof hooks } = {
    isSupported,
    hooks,
    sanitize: vi.fn((dirty: string) => `[clean]${dirty}`),
    addHook: ((entry: string, hook: Hook) => { hooks[entry] = hook; }) as HtmlSanitiser['addHook'],
  };
  return s;
}

describe('markdown', () => {
  it('marks a rendering', () => {
    expect(markdown()).toEqual({ 'data-boogy': 'markdown' });
  });
  it('knows the names markdown goes by', () => {
    for (const l of ['md', 'markdown', 'MD', 'Markdown', 'mkd']) expect(isMarkdown(l)).toBe(true);
    for (const l of ['py', 'mdx', '', null, undefined]) expect(isMarkdown(l)).toBe(false);
  });
});

describe('markdownRenderer', () => {
  it('parses as GFM with chat line breaks, then sanitises all of it to an allowlist', () => {
    const spy = vi.spyOn(parser, 'parse');
    const s = sanitiser();
    const html = markdownRenderer(parser, s)('hi');
    expect(spy).toHaveBeenCalledWith('hi', { async: false, gfm: true, breaks: true });
    expect(html).toBe('[clean]<p>hi</p>');
    const config = (s.sanitize as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(config.ALLOWED_TAGS).not.toEqual(expect.arrayContaining(['form']));
    expect(config.ALLOWED_TAGS).toEqual(expect.arrayContaining(['p', 'a', 'table', 'input']));
    expect(config.ALLOWED_ATTR).not.toEqual(expect.arrayContaining(['id', 'name', 'style', 'target']));
    expect(config.ALLOW_DATA_ATTR).toBe(false);
    expect(config.ALLOW_ARIA_ATTR).toBe(false);
  });
  it('where the sanitiser cannot work, the markdown is escaped text and never reaches it', () => {
    const s = sanitiser(false);
    const html = markdownRenderer(parser, s)('<script>alert(1)</script>\n# x');
    expect(html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;<br># x</p>');
    expect(s.sanitize).not.toHaveBeenCalled();
    expect(Object.keys(s.hooks)).toHaveLength(0);
  });
  it('its hook sends a link to a new tab with nothing back, and an image with no referrer', () => {
    const s = sanitiser();
    markdownRenderer(parser, s);
    const a = document.createElement('a');
    a.setAttribute('href', 'https://example.com');
    const bare = document.createElement('a');
    const img = document.createElement('img');
    for (const node of [a, bare, img]) s.hooks.afterSanitizeAttributes(node);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(bare.hasAttribute('target')).toBe(false);
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img.getAttribute('loading')).toBe('lazy');
  });
  it('every input is a disabled checkbox (a task list), never a field to type in', () => {
    const s = sanitiser();
    markdownRenderer(parser, s);
    const input = document.createElement('input');
    input.setAttribute('type', 'password');
    s.hooks.afterSanitizeAttributes(input);
    expect(input.getAttribute('type')).toBe('checkbox');
    expect(input.hasAttribute('disabled')).toBe(true);
  });
  it('a class survives only as code\'s language, so nothing borrows the page\'s styles', () => {
    const s = sanitiser();
    markdownRenderer(parser, s);
    const keep = (tag: string, value: string) => {
      const data = { attrName: 'class', attrValue: value, keepAttr: true };
      s.hooks.uponSanitizeAttribute(document.createElement(tag), data);
      return data.keepAttr;
    };
    expect(keep('code', 'language-py')).toBe(true);
    expect(keep('code', 'language-py evil')).toBe(false);
    expect(keep('span', 'language-py')).toBe(false);
    expect(keep('p', 'row-actions')).toBe(false);
  });
  it('an attribute survives only on the tag GFM puts it on', () => {
    const s = sanitiser();
    markdownRenderer(parser, s);
    const keep = (tag: string, attrName: string) => {
      const data = { attrName, attrValue: 'x', keepAttr: true };
      s.hooks.uponSanitizeAttribute(document.createElement(tag), data);
      return data.keepAttr;
    };
    expect(keep('img', 'src')).toBe(true);
    expect(keep('a', 'href')).toBe(true);
    expect(keep('input', 'src')).toBe(false);
    expect(keep('p', 'title')).toBe(false);
    expect(keep('td', 'align')).toBe(true);
  });
});
