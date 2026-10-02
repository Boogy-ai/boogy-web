import { describe, it, expect } from 'vitest';
import { FOUNDATION_CSS } from './foundation-css';

const CODE = FOUNDATION_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
/** Every declaration of the three units, as written. */
const unitDeclarations = () =>
  [...CODE.matchAll(/(--u(?:-inline|-block)?):\s*([^;]+);/g)].map((m) => ({ name: m[1], value: m[2].trim() }));

describe('interface zoom in the foundation', () => {
  it('registers --zoom as a number that defaults to 1', () => {
    expect(CODE).toContain("@property --zoom { syntax: '<number>'; inherits: true; initial-value: 1; }");
  });

  it('multiplies every declaration of the unit by --zoom: the root default and all three policies', () => {
    const decls = unitDeclarations();
    expect(decls).toHaveLength(12);
    for (const d of decls) expect(d.value, `${d.name}: ${d.value}`).toMatch(/\* var\(--zoom\)\)?$/);
  });

  it('a zoomed page sizes its plain text from the unit, as a scaled one does', () => {
    expect(CODE).toMatch(/:root:is\(\[data-u-policy\], \[data-zoom\]\) > body \{ font-size: var\(--fs-body\); \}/);
  });

  it("the root default does not depend on the root's own font size (no rem/em: a cycle when an app sizes its root font from the unit)", () => {
    const root = CODE.slice(CODE.indexOf(':root {'));
    const decl = /--u:\s*([^;]+);/.exec(root)![1];
    expect(decl).not.toMatch(/rem|em\b|var\(--u-base\)/);
  });
});
