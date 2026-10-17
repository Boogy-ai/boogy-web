import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { CodeBlock, FencedText } from './index';
import { loadHighlighter, type Highlighter } from '@boogy/web';

beforeAll(async () => {
  // Prime the loader with the vendored highlighter, as the host serves it.
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
const lines = (n: number) => Array.from({ length: n }, (_, i) => `x${i} = ${i}`).join('\n');

describe('<CodeBlock>', () => {
  it('the code, highlighted, under its language; never as HTML it was given', async () => {
    const root = mount(<CodeBlock code={'def f():\n    return "<i>"'} language="py" />);
    await settle();
    const block = root.querySelector('[data-boogy="code-block"]')!;
    expect(block.querySelector('[data-slot="language"]')!.textContent).toBe('Python');
    const code = block.querySelector('pre[data-slot="code"] > code')!;
    expect(code.querySelector('.hljs-keyword')!.textContent).toBe('def');
    expect(code.querySelector('i')).toBeNull();
    expect(code.textContent).toBe('def f():\n    return "<i>"');
  });

  it('an unknown language is shown as plain text, under the name it was given', async () => {
    const root = mount(<CodeBlock code="<b>hi</b>" language="nope" />);
    await settle();
    expect(root.querySelector('[data-slot="language"]')!.textContent).toBe('nope');
    expect(root.querySelector('code b')).toBeNull();
    expect(root.querySelector('code')!.textContent).toBe('<b>hi</b>');
  });

  it('longer than collapseAfter: collapsed, with a footer that shows all of it, and back', async () => {
    const root = mount(<CodeBlock code={lines(25)} language="py" collapseAfter={10} />);
    await settle();
    const block = root.querySelector('[data-boogy="code-block"]') as HTMLElement;
    expect(block.getAttribute('data-collapsed')).toBe('true');
    expect(block.style.getPropertyValue('--code-lines')).toBe('10');
    const more = block.querySelector('[data-slot="foot"] button') as HTMLButtonElement;
    expect(more.textContent).toBe('Show all 25 lines');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    act(() => more.click());
    expect(block.hasAttribute('data-collapsed')).toBe(false);
    expect(more.textContent).toBe('Show less');
    expect(more.getAttribute('aria-expanded')).toBe('true');
  });

  it('no longer than collapseAfter: no footer', () => {
    const root = mount(<CodeBlock code={lines(10)} collapseAfter={10} />);
    expect(root.querySelector('[data-slot="foot"]')).toBeNull();
    expect(root.querySelector('[data-boogy="code-block"]')!.hasAttribute('data-collapsed')).toBe(false);
  });

  it('highlights once, not again on every render (a Copy, a toggle)', async () => {
    const hl = await loadHighlighter();
    const spy = vi.spyOn(hl, 'highlight');
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
    const root = mount(<CodeBlock code={lines(15)} language="py" collapseAfter={10} />);
    await settle();
    const before = spy.mock.calls.length;
    const copy = [...root.querySelectorAll('button')].find((b) => b.textContent === 'Copy')!;
    await act(async () => { copy.click(); });
    act(() => (root.querySelector('[data-slot="foot"] button') as HTMLButtonElement).click());
    expect(before).toBe(1);
    expect(spy.mock.calls.length).toBe(1);
  });

  it('Copy puts the code on the clipboard and says so', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const root = mount(<CodeBlock code="ls -la" language="sh" />);
    const copy = [...root.querySelectorAll('button')].find((b) => b.textContent === 'Copy')!;
    await act(async () => { copy.click(); });
    expect(writeText).toHaveBeenCalledWith('ls -la');
    expect(copy.textContent).toBe('Copied');
  });
});

describe('<FencedText>', () => {
  it('its text and its fenced code, in order; the code in blocks that collapse as asked', async () => {
    const root = mount(<FencedText text={`Try this:\n\`\`\`py\n${lines(12)}\n\`\`\`\nThen run it.`} collapseAfter={10} />);
    await settle();
    const el = root.querySelector('[data-boogy="fenced-text"]')!;
    expect([...el.children].map((c) => c.getAttribute('data-slot') ?? c.getAttribute('data-boogy'))).toEqual(['text', 'code-block', 'text']);
    expect(el.children[0].textContent).toBe('Try this:');
    expect(el.querySelector('[data-boogy="code-block"]')!.getAttribute('data-collapsed')).toBe('true');
    expect(el.children[2].textContent).toBe('Then run it.');
  });
  it('text with no fence is just the text', () => {
    const root = mount(<FencedText text="hello" />);
    expect(root.querySelector('[data-boogy="fenced-text"]')!.textContent).toBe('hello');
    expect(root.querySelector('[data-boogy="code-block"]')).toBeNull();
  });
});
