import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { CodeBlock, Markdown } from './index';
import { loadHighlighter, loadMarkdown, markdownRenderer, type Highlighter } from '@boogy/web';

beforeAll(async () => {
  // The component's behaviour, over the real parser. Sanitising is DOMPurify's,
  // tested in a real browser (test-browser/markdown.browser.test.ts); this
  // test DOM does not parse HTML faithfully enough for it, so it passes here.
  const { marked } = (await import('../vendor/marked-18.0.14.js' as string)) as { marked: Parameters<typeof markdownRenderer>[0] };
  await loadMarkdown(async () => markdownRenderer(marked, { isSupported: true, sanitize: (html) => html, addHook: () => {} }));
  await loadHighlighter(async () => ((await import('../vendor/highlight-11.11.1.js' as string)) as { default: Highlighter }).default);
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return root;
}
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const SAMPLE = '# Notes\n\nSome **bold** text.\n\n```py\ndef f(): pass\n```';

describe('<Markdown>', () => {
  it('renders the markdown, its code highlighted', async () => {
    const root = mount(<Markdown text={SAMPLE} />);
    await settle();
    const el = root.querySelector('[data-boogy="markdown"]')!;
    expect(el.querySelector('h1')?.textContent).toBe('Notes');
    expect(el.querySelector('strong')?.textContent).toBe('bold');
    expect(el.querySelector('pre code .hljs-keyword')?.textContent).toBe('def');
  });
});

describe('<CodeBlock> of markdown', () => {
  it('two tabs, Preview first: the rendering; Markdown: the source, highlighted', async () => {
    const root = mount(<CodeBlock code={SAMPLE} language="md" />);
    await settle();
    const block = root.querySelector('[data-boogy="code-block"]')!;
    const tabs = [...block.querySelectorAll('[data-slot="head"] [role="tab"]')];
    expect(tabs.map((t) => t.textContent)).toEqual(['Preview', 'Markdown']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    const panel = block.querySelector('[role="tabpanel"]')!;
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id);
    expect(panel.querySelector('[data-boogy="markdown"] h1')?.textContent).toBe('Notes');
    // Both views are laid out, so the block keeps its width as the tabs change;
    // the one not shown is marked so.
    const source = block.querySelector('pre[data-slot="code"]')!;
    expect(source.hasAttribute('data-inactive')).toBe(true);
    expect(source.getAttribute('aria-hidden')).toBe('true');
    expect(panel.hasAttribute('data-inactive')).toBe(false);
    act(() => (tabs[1] as HTMLButtonElement).click());
    await settle();
    expect(block.querySelector('[data-slot="preview"]')!.hasAttribute('data-inactive')).toBe(true);
    expect(block.querySelector('[role="tabpanel"]')).toBe(source);
    const code = block.querySelector('pre[data-slot="code"] > code')!;
    expect(code.textContent).toBe(SAMPLE);
    expect(code.querySelector('[class^="hljs-"]')).not.toBeNull();
  });
  it('Copy copies the source, from either tab', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const root = mount(<CodeBlock code={SAMPLE} language="markdown" />);
    await settle();
    const copy = [...root.querySelectorAll('button')].find((b) => b.textContent === 'Copy')!;
    await act(async () => { copy.click(); });
    expect(writeText).toHaveBeenCalledWith(SAMPLE);
  });
  it('collapsed, a link below the cut-off opens the block when Tab reaches it', async () => {
    const long = `${Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n\n')}\n\n[late](https://example.com)`;
    const root = mount(<CodeBlock code={long} language="md" collapseAfter={10} />);
    await settle();
    const block = root.querySelector('[data-boogy="code-block"]')!;
    expect(block.getAttribute('data-collapsed')).toBe('true');
    act(() => { (block.querySelector('[data-slot="preview"] a') as HTMLAnchorElement).focus(); });
    expect(block.hasAttribute('data-collapsed')).toBe(false);
  });
  it('another language has no tabs', async () => {
    const root = mount(<CodeBlock code="x = 1" language="py" />);
    await settle();
    expect(root.querySelector('[role="tab"]')).toBeNull();
  });
});
