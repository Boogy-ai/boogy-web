// Test helper: the body of one rule in the components stylesheet (or any
// stylesheet text). Kept out of src/ so it is never bundled or published with
// the package.
import { COMPONENTS_CSS } from '../src/components/components-css';

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const CODE = strip(COMPONENTS_CSS);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function find(code: string, selector: string): string {
  const m = new RegExp(`(?:^|\\n)[ \\t]*${escape(selector)} \\{`).exec(code);
  return m ? code.slice(m.index, code.indexOf('}', m.index + m[0].length)) : '';
}

/** The body of the rule whose selector (list) ENDS with `selector`, matched at
 *  the start of a line — so a longer rule that merely ends in the same text
 *  (a descendant of it, `A > B` for `B`) never answers for it. `''` when there
 *  is no such rule. */
export function ruleFor(selector: string): string {
  return find(CODE, selector);
}

/** `ruleFor` in any stylesheet text: the foundation, one part of the
 *  components sheet, or what an at-rule holds (`blockOf`). */
export function ruleIn(css: string, selector: string): string {
  return find(strip(css), selector);
}

/** What the first `<prelude> { … }` block holds (an at-rule such as
 *  `@media (pointer: coarse)`), comments removed: the rules that apply only
 *  under it. `''` when there is none. */
export function blockOf(css: string, prelude: string): string {
  const code = strip(css);
  const start = code.indexOf(`${prelude} {`);
  if (start < 0) return '';
  const open = code.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}' && --depth === 0) return code.slice(open + 1, i);
  }
  return '';
}
