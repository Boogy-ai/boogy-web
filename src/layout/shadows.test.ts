import { describe, it, expect } from 'vitest';
import { FOUNDATION_CSS } from './foundation-css';
import { COMPONENTS_CSS } from '../components/components-css';

const token = (name: string) => FOUNDATION_CSS.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1];

describe('shadow tokens (HeroUI v3 roles)', () => {
  it('defines surface, overlay and field shadows, each for light and dark', () => {
    for (const name of ['--surface-shadow', '--overlay-shadow', '--field-shadow']) {
      expect(token(name), name).toMatch(/light-dark\(/);
    }
  });
  it('dark keeps an overlay\'s lift, and drops surface and field shadows as HeroUI does', () => {
    expect(token('--overlay-shadow')).toMatch(/light-dark\([^,]+,\s*rgb\(0 0 0 \/ 0\.\d+\)\)/);
    expect(token('--surface-shadow')).toMatch(/light-dark\([^,]+,\s*transparent\)/);
    expect(token('--field-shadow')).toMatch(/light-dark\([^,]+,\s*transparent\)/);
  });
});

describe('components use the shadow tokens', () => {
  const code = COMPONENTS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  it('every box-shadow in a component is a role token or none', () => {
    const shadows = [...code.matchAll(/box-shadow:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(shadows.length).toBeGreaterThan(0);
    for (const s of shadows) expect(s).toMatch(/^(none|var\(--(surface|overlay|field)-shadow\))$/);
  });
  it('the popover and the overlaid drawer float on --overlay-shadow', () => {
    expect(code).toMatch(/\[data-boogy="popover"\] \{[^}]*box-shadow:\s*var\(--overlay-shadow\)/);
    expect(code).toMatch(/\[data-boogy="drawer"\] \{[^}]*box-shadow:\s*var\(--overlay-shadow\)/);
  });
});
