// <CodeBlock> and <FencedText> (see `codeBlock()` in the core package).
import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  codeBlock, fencedText, highlightHtml, isMarkdown, languageName, lineCount, loadedHighlighter, loadedLinkFinder, loadHighlighter,
  loadLinkFinder, mayHaveLinks, previewable, splitFences, splitLinks, tabId, type LinkSegment,
} from '@boogy/web';
import { Button } from './button';
import { LinkPreview } from './link-preview';
import { Markdown } from './markdown';
import { TabList } from './tabs';
import { useId } from './use-id';
import { useVendor } from './use-vendor';

/** How long "Copied" shows after a copy. */
const COPIED_MS = 2000;
/** A markdown block's two views, Preview first. */
const MARKDOWN_VIEWS = [{ id: 'preview', label: 'Preview' }, { id: 'source', label: 'Markdown' }] as const;

export type CodeBlockProps = {
  code: string;
  /** Its language as a fence names it (`py`, `ts`, `rust`): highlight.js's
   *  name or alias. Unknown or absent, the code shows plain. */
  language?: string | null;
  /** Show only this many lines, with a footer that shows the rest. A block
   *  of markdown collapses its preview to the same height. */
  collapseAfter?: number;
} & Omit<JSX.HTMLAttributes<HTMLElement>, 'children'>;

export function CodeBlock({ code, language = null, collapseAfter, ...rest }: CodeBlockProps) {
  // Plain until highlight.js loads (and for a language it does not know).
  const hl = useVendor(loadHighlighter, loadedHighlighter, !!language);
  // Markdown has two views: its rendering, then its source.
  const md = isMarkdown(language);
  const [view, setView] = useState<'preview' | 'source'>('preview');
  const previewing = md && view === 'preview';
  const panel = useId('code-');

  const total = lineCount(code);
  const collapsible = collapseAfter !== undefined && total > collapseAfter;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(t);
  }, [copied]);
  const codeEl = useRef<HTMLElement>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Framed, the clipboard may be refused: select the code to copy by hand.
      if (codeEl.current) getSelection()?.selectAllChildren(codeEl.current);
    }
  };

  // Once per code, not on every render: a long thread re-renders often.
  const html = useMemo(() => (hl ? highlightHtml(hl, code, language) : null), [hl, code, language]);
  const label = language ? (hl ? languageName(hl, language) : language) : null;

  // A preview is clipped by height, not counted lines: its footer shows only
  // when the rendering is taller than the clip.
  const previewEl = useRef<HTMLDivElement>(null);
  const [previewClipped, setPreviewClipped] = useState(false);
  useLayoutEffect(() => {
    const el = previewEl.current;
    if (!previewing || !collapsible || open || !el) return;
    const measure = () => setPreviewClipped(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => ro?.disconnect();
  }, [previewing, collapsible, open, code]);
  const foot = collapsible && (previewing ? previewClipped || open : true);

  const style = collapsible ? { ...(rest.style as object | undefined), '--code-lines': String(collapseAfter) } : rest.style;
  // A markdown block lays out both its views, the one not shown at no height,
  // so the block is as wide as the wider and a tab change moves nothing
  // around it. The one shown is the panel its tabs control.
  const shown: Pick<JSX.HTMLAttributes<HTMLElement>, 'id' | 'role' | 'aria-labelledby'> = { id: panel, role: 'tabpanel', 'aria-labelledby': tabId(panel, view) };
  const notShown = { 'data-inactive': '', 'aria-hidden': 'true' } as const;
  const preview = md && (
    <div {...(previewing ? shown : notShown)} data-slot="preview" ref={previewEl}
      // Tab landing on a link below the cut-off opens the block, so it shows.
      onFocusCapture={() => { if (collapsible && !open) setOpen(true); }}>
      <Markdown text={code} />
    </div>
  );
  const source = (
    <pre {...(md ? (previewing ? notShown : shown) : {})} data-slot="code">
      {html !== null
        // highlight.js escapes the code; its output is spans around text.
        ? <code ref={codeEl} class="hljs" dangerouslySetInnerHTML={{ __html: html }} />
        : <code ref={codeEl}>{code}</code>}
    </pre>
  );
  return (
    <figure {...rest} {...codeBlock({ collapsed: collapsible && !open })} style={style as JSX.CSSProperties}>
      <figcaption data-slot="head">
        {md
          ? <TabList label="View" panel={panel} selected={view} onSelect={(id) => setView(id as 'preview' | 'source')} items={MARKDOWN_VIEWS} />
          : label && <span data-slot="language">{label}</span>}
        <Button size="sm" variant="quiet" glyph={copied ? 'check' : 'copy'} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
      </figcaption>
      {preview}
      {source}
      {foot && (
        <div data-slot="foot">
          <Button size="sm" variant="quiet" aria-expanded={open ? 'true' : 'false'} onClick={() => setOpen(!open)}>
            {open ? 'Show less' : previewing ? 'Show all' : `Show all ${total} lines`}
          </Button>
        </div>
      )}
    </figure>
  );
}

export type FencedTextProps = {
  text: string;
  /** Each code block shows only this many lines until opened. */
  collapseAfter?: number;
  /** A card under the text for each of its first this many https links (in
   *  its text, never its code), as messengers show them. Default 2; 0 for
   *  none. Links after those are links only. */
  previews?: number;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children'>;

/** The previews a message shows unless it says otherwise. */
const PREVIEWS = 2;

/** Text with its markdown fences (```py … ```) as code blocks, and the web
 *  addresses in its text as links, the first few with a card. */
export function FencedText({ text, collapseAfter, previews = PREVIEWS, ...rest }: FencedTextProps) {
  const parts = useMemo(() => splitFences(text), [text]);
  // The link finder loads only for text that could hold a link; until then
  // the text shows as it is.
  const finder = useVendor(loadLinkFinder, loadedLinkFinder, parts.some((s) => s.kind === 'text' && mayHaveLinks(s.text)));
  const runs = useMemo(
    () => parts.map((s) => (s.kind === 'text' ? splitLinks(s.text, finder ?? { find: () => [] }) : null)),
    [parts, finder],
  );
  const cards = previewable(runs.flatMap((r) => (r ?? []).flatMap((s) => (s.kind === 'link' ? [s.href] : []))), previews);
  return (
    <div {...rest} {...fencedText()}>
      {parts.map((s, i) =>
        s.kind === 'text'
          ? <p key={i} data-slot="text"><Linked run={runs[i] ?? []} /></p>
          : <CodeBlock key={i} code={s.code} language={s.language} collapseAfter={collapseAfter} />,
      )}
      {cards.length > 0 && <div data-slot="previews">{cards.map((url) => <LinkPreview key={url} url={url} />)}</div>}
    </div>
  );
}

/** A run of text with its links, each opening in a new tab. */
function Linked({ run }: { run: LinkSegment[] }) {
  return (
    <>
      {run.map((s, i) =>
        s.kind === 'link'
          ? <a key={i} data-slot="link" href={s.href} target="_blank" rel="noopener noreferrer">{s.text}</a>
          : s.text,
      )}
    </>
  );
}
