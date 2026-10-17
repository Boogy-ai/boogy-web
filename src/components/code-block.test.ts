import { describe, it, expect } from 'vitest';
import { codeBlock, highlightHtml, languageName, lineCount, loadHighlighter, splitFences, type Highlighter } from './code-block';

const vendored = () => import('../../vendor/highlight-11.11.1.js' as string) as Promise<{ default: Highlighter }>;

describe('codeBlock', () => {
  it('marks a block; collapsed only when asked', () => {
    expect(codeBlock()).toEqual({ 'data-boogy': 'code-block' });
    expect(codeBlock({ collapsed: true })).toEqual({ 'data-boogy': 'code-block', 'data-collapsed': 'true' });
  });
});

describe('splitFences', () => {
  it('plain text is one run', () => {
    expect(splitFences('hello\nthere')).toEqual([{ kind: 'text', text: 'hello\nthere' }]);
  });
  it('a fence between text: the text, the code with its language, the text; no blank lines kept around it', () => {
    expect(splitFences('Look:\n\n```py\nprint(1)\nprint(2)\n```\n\nnice')).toEqual([
      { kind: 'text', text: 'Look:' },
      { kind: 'code', language: 'py', code: 'print(1)\nprint(2)' },
      { kind: 'text', text: 'nice' },
    ]);
  });
  it('a fence with no language, or more words after it, or an empty body', () => {
    expect(splitFences('```\nx\n```')).toEqual([{ kind: 'code', language: null, code: 'x' }]);
    expect(splitFences('```ts title="a.ts"\nlet a\n```')).toEqual([{ kind: 'code', language: 'ts', code: 'let a' }]);
    expect(splitFences('```\n```')).toEqual([{ kind: 'code', language: null, code: '' }]);
  });
  it('an unclosed fence runs to the end, as markdown says', () => {
    expect(splitFences('see\n```js\nlet a = 1')).toEqual([
      { kind: 'text', text: 'see' },
      { kind: 'code', language: 'js', code: 'let a = 1' },
    ]);
  });
  it('closes only on a bare fence at least as long as the one that opened it', () => {
    expect(splitFences('````md\n```py\nx\n```\n````')).toEqual([{ kind: 'code', language: 'md', code: '```py\nx\n```' }]);
    expect(splitFences('```py\na\n``` not a close\nb\n```')).toEqual([{ kind: 'code', language: 'py', code: 'a\n``` not a close\nb' }]);
  });
  it('tilde fences too, whose info may hold backticks; each closes only on its own kind', () => {
    expect(splitFences('~~~py\nx = `a`\n```\n~~~')).toEqual([{ kind: 'code', language: 'py', code: 'x = `a`\n```' }]);
    expect(splitFences('~~~ js `odd` info\n1\n~~~~')).toEqual([{ kind: 'code', language: 'js', code: '1' }]);
  });
  it('a markdown block may hold fenced code with fences of the same length', () => {
    expect(splitFences('```md\n# Notes\n```py\nprint(1)\n```\nafter\n```\nThen.')).toEqual([
      { kind: 'code', language: 'md', code: '# Notes\n```py\nprint(1)\n```\nafter' },
      { kind: 'text', text: 'Then.' },
    ]);
  });
  it('backticks inside a line are not a fence', () => {
    expect(splitFences('use ``` to fence code')).toEqual([{ kind: 'text', text: 'use ``` to fence code' }]);
  });
  it('a fence may be indented up to three spaces, and CRLF lines read as LF', () => {
    expect(splitFences('  ```sh\r\nls\r\n  ```')).toEqual([{ kind: 'code', language: 'sh', code: 'ls' }]);
  });
  it('two blocks in a row, with nothing between them', () => {
    expect(splitFences('```a\n1\n```\n```b\n2\n```').map((s) => s.kind)).toEqual(['code', 'code']);
  });
});

describe('lineCount', () => {
  it('counts lines, a final newline ending the last rather than starting another', () => {
    expect(lineCount('')).toBe(0);
    expect(lineCount('a')).toBe(1);
    expect(lineCount('a\nb')).toBe(2);
    expect(lineCount('a\nb\n')).toBe(2);
  });
});

describe('highlighting, by the vendored highlight.js', () => {
  it('marks a known language up, escaping the code; an unknown one is left plain', async () => {
    const hl = await loadHighlighter(async () => (await vendored()).default);
    const html = highlightHtml(hl, 'def f(x):\n    return "<b>"', 'py')!;
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<b>');
    expect(highlightHtml(hl, 'x', 'no-such-language')).toBeNull();
    expect(highlightHtml(hl, 'x', null)).toBeNull();
    expect(languageName(hl, 'py')).toBe('Python');
    expect(languageName(hl, 'ts')).toBe('TypeScript');
    expect(languageName(hl, 'no-such-language')).toBe('no-such-language');
  });
  it('loads once, and tries again after a failed load', async () => {
    const first = loadHighlighter(async () => (await vendored()).default);
    expect(loadHighlighter(async () => { throw new Error('never called'); })).toBe(first);
  });
});
