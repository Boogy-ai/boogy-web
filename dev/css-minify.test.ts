import { describe, it, expect } from 'vitest';
import { minifyCssLiterals, isSdkCssModule } from './css-minify';

describe('minifyCssLiterals', () => {
  it('strips CSS comments and collapses whitespace inside template literals', () => {
    const src = 'const A = `\n  /* why this rule */\n  [data-boogy="x"] {\n    color: red; /* ink */\n    margin: 0 1px;\n  }\n`;';
    expect(minifyCssLiterals(src)).toBe('const A = `[data-boogy="x"]{color: red;margin: 0 1px;}`;');
  });

  it('keeps every ${…} expression, minifying only the text around it', () => {
    const src = 'const B = `\n  ${SEL} {\n    /* c */\n    gap: ${GAP};\n  }\n${Object.keys(X).map(f).join(\'\')}\n`;';
    expect(minifyCssLiterals(src)).toBe("const B = `${SEL}{gap: ${GAP};}${Object.keys(X).map(f).join('')}`;");
  });

  it('leaves a quoted string in the CSS exactly as written', () => {
    expect(minifyCssLiterals('x = `a::before { content: "  two  spaces  /* not a comment */ "; }`'))
      .toBe('x = `a::before{content: "  two  spaces  /* not a comment */ ";}`');
  });

  it('keeps track of quotes across ${…}: a string after an interpolated attribute value stays exact', () => {
    const src = 'x = `[a="${v}"] { color: red } b::before { content: "a  b ; c" }`';
    expect(minifyCssLiterals(src)).toBe('x = `[a="${v}"]{color: red}b::before{content: "a  b ; c"}`');
  });

  it('never removes a space that changes a selector', () => {
    expect(minifyCssLiterals('x = `div :is(a, b) > p  span:hover {}`')).toBe('x = `div :is(a, b) > p span:hover{}`');
  });

  it('leaves code outside template literals, and a literal with a backslash escape, as they were', () => {
    const src = "const s = '/* not css */'; // keep\nconst t = `a\\`b  /* x */ c`;";
    const out = minifyCssLiterals(src);
    expect(out.startsWith("const s = '/* not css */'; // keep\n")).toBe(true);
    expect(out).toContain('`a\\`b c`');
  });

  it('a nested template literal inside an expression is handled too', () => {
    const src = 'x = `${y ? `  a  /* c */ {  }` : ``}  b  `';
    expect(minifyCssLiterals(src)).toBe('x = `${y ? `a{}` : ``} b`');
  });
});

describe('isSdkCssModule', () => {
  it("names the SDK's CSS modules, source or built, and nothing else", () => {
    for (const id of ['/repo/packages/web-sdk/src/components/components-css.ts', '/x/node_modules/@boogy/web/dist/layout/foundation-css.js',
                      // A workspace install: Vite resolves the link to the SDK's real dist.
                      '/repo/packages/web-sdk/dist/layout/foundation-css.js',
                      '/repo/packages/web-sdk/src/layout/fonts-css.ts?v=1'])
      expect(isSdkCssModule(id), id).toBe(true);
    for (const id of ['/app/web/my-css.ts', '/repo/packages/web-sdk/src/pane.ts', '/repo/packages/web-sdk/src/components/components-css.test.ts'])
      expect(isSdkCssModule(id), id).toBe(false);
  });
});
