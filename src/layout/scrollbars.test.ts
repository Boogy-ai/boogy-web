import { describe, it, expect } from 'vitest';
import { FOUNDATION_CSS } from './foundation-css';

const code = FOUNDATION_CSS.replace(/\/\*[\s\S]*?\*\//g, '');

describe('scrollbars follow the theme', () => {
  it('are thin, on a transparent track, with a thumb tinted from the text', () => {
    expect(code).toMatch(/\*\s*\{\s*scrollbar-width:\s*thin;\s*scrollbar-color:\s*var\(--scrollbar-thumb\) transparent;\s*\}/);
    expect(code).toMatch(/--scrollbar-thumb:\s*color-mix\(in oklch, var\(--text-1\) \d+%, transparent\);/);
  });
  it('brighten a step while the pointer is over the area they scroll', () => {
    expect(code).toMatch(/\*:hover\s*\{\s*scrollbar-color:\s*var\(--scrollbar-thumb-hover\) transparent;\s*\}/);
    expect(code).toMatch(/--scrollbar-thumb-hover:\s*color-mix\(in oklch, var\(--text-1\) \d+%, transparent\);/);
  });
});
