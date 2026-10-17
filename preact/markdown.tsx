// <Markdown>: markdown rendered and sanitised (see `markdown()` in the core
// package), its fenced code highlighted as a CodeBlock's is. Until the
// renderer loads, the markdown shows as its text.
import type { JSX } from 'preact';
import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { highlightHtml, loadedHighlighter, loadedMarkdown, loadHighlighter, loadMarkdown, markdown } from '@boogy/web';
import { useVendor } from './use-vendor';

export type MarkdownProps = { text: string } & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children'>;

export function Markdown({ text, ...rest }: MarkdownProps) {
  const render = useVendor(loadMarkdown, loadedMarkdown, true);
  // Once per text, not on every render.
  const html = useMemo(() => (render ? render(text) : null), [render, text]);
  const hasCode = html !== null && html.includes('<pre><code class="language-');
  const hl = useVendor(loadHighlighter, loadedHighlighter, hasCode);
  const el = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = el.current;
    if (!root || !hl) return;
    root.querySelectorAll<HTMLElement>('pre > code[class^="language-"]').forEach((code) => {
      const out = highlightHtml(hl, code.textContent ?? '', code.className.slice('language-'.length));
      // highlight.js escapes the code; its output is spans around text.
      if (out !== null) { code.innerHTML = out; code.classList.add('hljs'); }
    });
  }, [html, hl]);
  if (html === null) return <div {...rest} {...markdown()}><p data-slot="plain">{text}</p></div>;
  // Sanitised by DOMPurify (or, where it cannot work, escaped text).
  return <div {...rest} {...markdown()} ref={el} dangerouslySetInnerHTML={{ __html: html }} />;
}
