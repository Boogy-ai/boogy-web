// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FONTS_CSS, FONT_FILES, FONTS_PATH } from './fonts-css';

const onDisk = readdirSync(join(__dirname, '../../fonts')).filter((f) => f.endsWith('.woff2')).sort();

describe('fonts', () => {
  it('declares exactly the font files the package ships', () => {
    expect([...FONT_FILES].sort()).toEqual(onDisk);
  });

  it('points every face at the platform path, same-origin and root-absolute', () => {
    expect(FONTS_PATH).toBe('/boogy/fonts/');
    for (const f of FONT_FILES) expect(FONTS_CSS).toContain(`url('/boogy/fonts/${f}') format('woff2')`);
    expect(FONTS_CSS).not.toMatch(/googleapis|gstatic|https?:/);
  });

  it("names the families the console uses", () => {
    for (const family of ['Figtree', 'JetBrains Mono', 'Syne', 'Unica One']) {
      expect(FONTS_CSS).toContain(`font-family: "${family}";`);
    }
  });

  it('swaps in rather than hiding text while a face loads', () => {
    const faces = FONTS_CSS.match(/@font-face/g)!.length;
    expect(FONTS_CSS.match(/font-display: swap;/g)!.length).toBe(faces);
  });
});
