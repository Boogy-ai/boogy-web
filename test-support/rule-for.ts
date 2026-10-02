// Test helper: the body of one rule in the components stylesheet. Kept out
// of src/ so it is never bundled or published with the package.
import { COMPONENTS_CSS } from '../src/components/components-css';

const CODE = COMPONENTS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The body of the rule whose selector (list) ENDS with `selector`, matched at
 *  the start of a line — so a longer rule that merely ends in the same text
 *  (a descendant of it, `A > B` for `B`) never answers for it. `''` when there
 *  is no such rule. */
export function ruleFor(selector: string): string {
  const m = new RegExp(`(?:^|\\n)[ \\t]*${escape(selector)} \\{`).exec(CODE);
  return m ? CODE.slice(m.index, CODE.indexOf('}', m.index + m[0].length)) : '';
}
