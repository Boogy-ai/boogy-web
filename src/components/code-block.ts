// CodeBlock: code under its language's name, highlighted by highlight.js (an
// established highlighter, never one of ours), with Copy, and collapsed to its
// first lines behind a footer that shows the rest when it is long. FencedText:
// a message's text with its markdown fences (```py … ```) as code blocks.
//
// The highlighter is not in the SDK's bundle: every app page loads the SDK, and
// most never show code. The host serves highlight.js on every origin at
// HIGHLIGHTER_PATH, cached for good, and a block imports it the first time one
// renders; until then, and for a language it does not know, the code shows as
// plain text. A block of markdown (```md) also shows it rendered (markdown.ts). Its output is the code escaped and wrapped in spans, so a block
// never renders the code as HTML.

import { isMarkdown } from './markdown';
import { importVendor, vendorLoader } from './vendor-loader';

/** Where the host serves highlight.js (its version is in the name). */
export const HIGHLIGHTER_PATH = '/boogy/vendor/highlight-11.11.1.js';

export interface CodeBlockAttrs {
  'data-boogy': 'code-block';
  'data-collapsed'?: 'true';
}

/** A block; `collapsed` while it shows only its first lines. */
export function codeBlock(opts: { collapsed?: boolean } = {}): CodeBlockAttrs {
  const attrs: CodeBlockAttrs = { 'data-boogy': 'code-block' };
  if (opts.collapsed) attrs['data-collapsed'] = 'true';
  return attrs;
}

export interface FencedTextAttrs {
  'data-boogy': 'fenced-text';
}

export function fencedText(): FencedTextAttrs {
  return { 'data-boogy': 'fenced-text' };
}

/** A run of a message: plain text, or the code of one fence. */
export type TextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'code'; code: string; language: string | null };

/** An opening fence: up to three spaces, three or more backticks or tildes,
 *  then an info string. A backtick fence's info holds no backtick (markdown's
 *  rule, so ``` inside a line is text). */
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/** `text` as runs of plain text and fenced code, in order (``` or ~~~). A fence's language
 *  is the first word of its info string (```py, ```ts title="a"); it closes on
 *  a line of only backticks, at least as many as opened it, and an unclosed one
 *  runs to the end, as markdown says. Blank lines around a block are dropped. */
export function splitFences(text: string): TextSegment[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: TextSegment[] = [];
  let run: string[] = [];
  const endRun = () => {
    while (run.length && run[0].trim() === '') run.shift();
    while (run.length && run[run.length - 1].trim() === '') run.pop();
    if (run.length) out.push({ kind: 'text', text: run.join('\n') });
    run = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const open = FENCE_OPEN.exec(lines[i]);
    const mark = open?.[1][0];
    if (!open || (mark === '`' && open[2].includes('`'))) {
      run.push(lines[i]);
      continue;
    }
    endRun();
    // Closed by the same mark, at least as many, alone on its line.
    const close = new RegExp(`^ {0,3}${mark}{${open[1].length},}\\s*$`);
    const info = open[2].trim();
    const language = info ? info.split(/\s+/)[0] : null;
    // Markdown holds fenced code of its own: there a fence with a language,
    // as long as the block's, opens a nested one, and the bare fence after it
    // closes that one, not the block. (Markdown itself wants a longer outer
    // fence; people write the same length.)
    const nests = isMarkdown(language);
    let depth = 0;
    const code: string[] = [];
    for (i++; i < lines.length; i++) {
      const inner = nests ? FENCE_OPEN.exec(lines[i]) : null;
      if (inner && inner[1][0] === mark && inner[1].length >= open[1].length && inner[2].trim() !== '' && !(mark === '`' && inner[2].includes('`'))) {
        depth++;
      } else if (close.test(lines[i])) {
        if (depth === 0) break;
        depth--;
      }
      code.push(lines[i]);
    }
    out.push({ kind: 'code', language, code: code.join('\n') });
  }
  endRun();
  return out;
}

/** How many lines `code` has; a final newline ends the last line. */
export function lineCount(code: string): number {
  if (code === '') return 0;
  const n = code.split('\n').length;
  return code.endsWith('\n') ? n - 1 : n;
}

/** What a block needs of highlight.js. */
export interface Highlighter {
  highlight(code: string, options: { language: string; ignoreIllegals?: boolean }): { value: string };
  getLanguage(name: string): { name?: string } | undefined;
}

const highlighter = vendorLoader<Highlighter>(async () => (await importVendor<{ default: Highlighter }>(HIGHLIGHTER_PATH)).default);

/** The highlighter, loaded once for the page (by `load`, the host's copy by
 *  default). A failed load is forgotten, so the next block tries again. */
export function loadHighlighter(load?: () => Promise<Highlighter>): Promise<Highlighter> {
  return highlighter.load(load);
}

/** The highlighter, if the page has loaded it already. */
export function loadedHighlighter(): Highlighter | null {
  return highlighter.loaded();
}

/** `code` marked up for `language`, escaped; `null` where there is no language
 *  or the highlighter does not know it (the block shows it plain). */
export function highlightHtml(hl: Highlighter, code: string, language: string | null): string | null {
  if (!language || !hl.getLanguage(language)) return null;
  return hl.highlight(code, { language, ignoreIllegals: true }).value;
}

/** A language's name as people write it (`py` is Python), or what was given. */
export function languageName(hl: Highlighter, language: string): string {
  return hl.getLanguage(language)?.name ?? language;
}
