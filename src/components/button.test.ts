import { describe, it, expect } from 'vitest';
import { button, BUTTON_VARIANTS } from './button';

describe('button', () => {
  it('defaults to a quiet, medium, text button with standard corners', () => {
    expect(button()).toEqual({ 'data-boogy': 'button', 'data-variant': 'quiet', 'data-shape': 'text', 'data-size': 'md' });
  });

  it('carries variant, shape and size', () => {
    expect(button({ variant: 'solid', shape: 'icon', size: 'sm' })).toMatchObject({
      'data-variant': 'solid', 'data-shape': 'icon', 'data-size': 'sm',
    });
  });

  it('is fully rounded when asked, whatever the variant', () => {
    for (const variant of BUTTON_VARIANTS) {
      expect(button({ variant, rounded: true })['data-rounded']).toBe('true');
      expect('data-rounded' in button({ variant })).toBe(false);
    }
  });

  it('carries the outline variant', () => {
    expect(button({ variant: 'outline' })['data-variant']).toBe('outline');
  });
  it('refuses values it has no styles for', () => {
    // @ts-expect-error — not a ButtonVariant
    expect(() => button({ variant: 'primary' })).toThrow(/solid, quiet, danger, outline/);
    // @ts-expect-error — not a ButtonShape
    expect(() => button({ shape: 'circle' })).toThrow(/text, icon/);
    // @ts-expect-error — not a ButtonSize
    expect(() => button({ size: 'xl' })).toThrow(/sm, md/);
  });
});
