// Minify the CSS the SDK ships inside JavaScript template literals.
//
// Meant for the SDK's own CSS modules: every template literal in a file it is
// run on is treated as CSS, and the scanner knows strings, comments and
// template literals but not regex literals (a regex holding a backtick would
// derail it). The SDK's CSS modules have neither. The
// foundation and component styles are written as commented, indented CSS in
// template strings; a JavaScript minifier never touches a string's contents, so
// without this every app would ship those comments and that indentation. This
// rewrites only the literal TEXT: comments go, whitespace collapses to one
// space, and the space beside `{`, `}` and `;` goes. Every `${…}` expression is
// kept as written, and a space that could change a selector (`div :hover`) is
// never removed.

/** One template-literal text segment, minified. `first` / `last`: the segment
 *  starts / ends the literal (rather than meeting a `${…}`), so its outer
 *  whitespace can go too. */
function minifySegment(
  text: string, first: boolean, last: boolean, open: string | null = null,
): { out: string; open: string | null } {
  // One pass, in CSS's own order: a comment ends at `*/` whatever quotes it
  // holds (an apostrophe in prose), and a quoted string is kept exactly (its
  // spaces are content, and a `/*` inside it is not a comment). `open` is the
  // quote a string is still inside from the segment before (`[a="${v}"]`), so
  // the pairing never flips across a `${…}`.
  let plain = '';
  let out = '';
  const flush = () => {
    out += plain.replace(/\s+/g, ' ').replace(/\s*([{};])\s*/g, '$1');
    plain = '';
  };
  let i = 0;
  if (open) {
    let j = 0;
    while (j < text.length && text[j] !== open) j += text[j] === '\\' ? 2 : 1;
    if (j >= text.length) return { out: text, open };
    out += text.slice(0, j + 1);
    i = j + 1;
    open = null;
  }
  while (i < text.length) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '*') {
      const e = text.indexOf('*/', i + 2);
      i = e < 0 ? text.length : e + 2;
      plain += ' ';
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === '\\' ? 2 : 1;
      flush();
      out += text.slice(i, j + 1);
      if (j >= text.length) open = c;
      i = j + 1;
      continue;
    }
    plain += c;
    i++;
  }
  flush();
  if (first && !out.startsWith('"') && !out.startsWith("'")) out = out.replace(/^ /, '');
  if (last && !open) out = out.replace(/ $/, '');
  return { out, open };
}

/** A whole stylesheet minified as one segment: what a literal with no
 *  expressions becomes. */
export function minifyCssText(css: string): string {
  return minifySegment(css, true, true).out;
}

/** `code` with the text of every template literal in it minified as CSS. */
export function minifyCssLiterals(code: string): string {
  let out = '';
  let i = 0;
  const n = code.length;

  // Copies a template literal starting at the backtick at `i`; returns the
  // index past its closing backtick.
  const literal = (start: number): number => {
    let j = start + 1;
    let seg = '';
    let first = true;
    let open: string | null = null;
    const emit = (isLast: boolean) => {
      const r = minifySegment(seg, first, isLast, open);
      open = r.open;
      return r.out;
    };
    out += '`';
    while (j < n) {
      const c = code[j];
      if (c === '\\') { seg += code.slice(j, j + 2); j += 2; continue; }
      if (c === '`') { out += emit(true) + '`'; return j + 1; }
      if (c === '$' && code[j + 1] === '{') {
        out += emit(false) + '${';
        seg = '';
        first = false;
        j = expression(j + 2);
        out += '}';
        continue;
      }
      seg += c;
      j++;
    }
    out += seg;
    return j;
  };

  // Copies the code of a `${…}` expression starting at `start` (past `${`),
  // through nested braces, strings and literals; returns the index past its `}`.
  const expression = (start: number): number => {
    let j = start;
    let depth = 0;
    while (j < n) {
      const c = code[j];
      if (c === '`') { j = literal(j); continue; }
      if (c === "'" || c === '"') { const e = quoted(j); out += code.slice(j, e); j = e; continue; }
      if (c === '{') depth++;
      if (c === '}') { if (depth === 0) return j + 1; depth--; }
      out += c;
      j++;
    }
    return j;
  };

  // The index past a '…' or "…" string starting at `start`.
  const quoted = (start: number): number => {
    const q = code[start];
    let j = start + 1;
    while (j < n && code[j] !== q) j += code[j] === '\\' ? 2 : 1;
    return j + 1;
  };

  while (i < n) {
    const c = code[i];
    if (c === '`') { i = literal(i); continue; }
    if (c === "'" || c === '"') { const e = quoted(i); out += code.slice(i, e); i = e; continue; }
    if (c === '/' && code[i + 1] === '/') { const e = code.indexOf('\n', i); const end = e < 0 ? n : e; out += code.slice(i, end); i = end; continue; }
    if (c === '/' && code[i + 1] === '*') { const e = code.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2; out += code.slice(i, end); i = end; continue; }
    out += c;
    i++;
  }
  return out;
}

/** Whether a module id is one of the SDK's CSS modules, its source or its
 *  built output: the files `minifyCssLiterals` is for. */
export function isSdkCssModule(id: string): boolean {
  const path = id.split('?')[0].replace(/\\/g, '/');
  if (/\.test\.[jt]s$/.test(path)) return false;
  // Its source, its dist as installed, or its dist reached through a workspace link.
  const sdk = /\/packages\/web-sdk\/(src|dist)\//.test(path) || /\/@boogy\/web\/dist\//.test(path);
  return sdk && /-css\.[jt]s$/.test(path);
}
