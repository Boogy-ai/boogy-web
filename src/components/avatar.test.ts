import { describe, it, expect } from 'vitest';
import { avatar, AVATAR_SIZES, AVATAR_VARIANTS } from './avatar';
import { ruleFor } from '../../test-support/rule-for';


describe('avatar', () => {
  it('a medium circle by default', () => {
    expect(avatar({ image: false })).toEqual({ 'data-boogy': 'avatar', 'data-size': 'md', 'data-variant': 'circle', 'data-image': 'false' });
  });
  it('two variants, a circle and a rounded square; three sizes', () => {
    expect(AVATAR_VARIANTS).toEqual(['circle', 'rounded']);
    expect(AVATAR_SIZES).toEqual(['sm', 'md', 'lg']);
    expect(avatar({ image: true, size: 'lg', variant: 'rounded' })).toEqual({ 'data-boogy': 'avatar', 'data-size': 'lg', 'data-variant': 'rounded', 'data-image': 'true' });
  });
  it('refuses a size or variant it does not have', () => {
    expect(() => avatar({ image: false, size: 'xl' as never })).toThrow(/size/);
    expect(() => avatar({ image: false, variant: 'square' as never })).toThrow(/variant/);
  });
  it('circle is fully round; rounded is a softened square', () => {
    expect(ruleFor('[data-boogy="avatar"][data-variant="circle"]')).toContain('border-radius: var(--radius-full)');
    expect(ruleFor('[data-boogy="avatar"][data-variant="rounded"]')).toContain('border-radius: var(--radius-2)');
  });
  it("sizes are the thumbnail's, so an avatar and a thumbnail line up", () => {
    for (const s of AVATAR_SIZES) {
      const r = ruleFor(`[data-boogy="avatar"][data-size="${s}"]`);
      expect(r).toContain(`width: var(--thumb-${s})`);
      expect(r).toContain(`height: var(--thumb-${s})`);
    }
  });
  it('the initials sit over the art, in white; a picture covers the whole avatar', () => {
    expect(ruleFor('[data-boogy="avatar"]')).toContain('position: relative');
    expect(ruleFor('[data-boogy="avatar"]')).toContain('color: oklch(0.98 0 0)');
    expect(ruleFor('[data-boogy="avatar"] > [data-slot="initials"]')).toContain('position: relative');
    expect(ruleFor('[data-boogy="avatar"] > img')).toContain('object-fit: cover');
  });
  it('seeded art fills the box it is placed in', () => {
    const r = ruleFor('[data-boogy="seeded-art"]');
    expect(r).toContain('position: absolute');
    expect(r).toContain('inset: 0');
  });
});

describe('avatar initials', () => {
  it('scale with the avatar itself: 42% of its diameter, at every size', () => {
    expect(ruleFor('[data-boogy="avatar"]')).toContain('container-type: size');
    expect(ruleFor('[data-boogy="avatar"] > [data-slot="initials"]')).toContain('font-size: 42cqmin');
    for (const s of AVATAR_SIZES) expect(ruleFor(`[data-boogy="avatar"][data-size="${s}"]`)).not.toContain('font-size');
  });
});
