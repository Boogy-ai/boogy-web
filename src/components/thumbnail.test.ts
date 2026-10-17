import { describe, it, expect } from 'vitest';
import { initialsOf, thumbnail, toneOf, THUMBNAIL_SIZES, THUMBNAIL_TONES } from './thumbnail';

describe('thumbnail', () => {
  it('is md with a tone from its label unless told otherwise', () => {
    expect(thumbnail({ label: 'Squad Chats', image: false })).toEqual({
      'data-boogy': 'thumbnail', 'data-size': 'md', 'data-tone': String(toneOf('Squad Chats')), 'data-image': 'false',
    });
  });
  it('says whether it shows an image', () => {
    expect(thumbnail({ label: 'x', image: true })['data-image']).toBe('true');
  });
  it('refuses a size it has no styles for', () => {
    // @ts-expect-error — not a ThumbnailSize
    expect(() => thumbnail({ label: 'x', size: 'xl', image: false })).toThrow(/sm.*md.*lg/);
  });
  it('lists its sizes', () => {
    expect([...THUMBNAIL_SIZES]).toEqual(['sm', 'md', 'lg']);
  });
});

describe('toneOf', () => {
  it('is stable: the same label always gets the same tone', () => {
    expect(toneOf('Squad Chats')).toBe(toneOf('Squad Chats'));
  });
  it('stays within the palette', () => {
    for (const l of ['', 'a', 'Wallet', 'Stripe Gateway', 'Governance', '日本語']) {
      const t = toneOf(l);
      expect(Number.isInteger(t) && t >= 0 && t < THUMBNAIL_TONES).toBe(true);
    }
  });
  it('spreads different labels across tones', () => {
    const tones = new Set(['Squad Chats', 'Boards', 'Polls', 'Wallet', 'Governance', 'Stripe Gateway', 'Chat EU', 'Notes'].map(toneOf));
    expect(tones.size).toBeGreaterThanOrEqual(4);
  });
});

describe('initialsOf', () => {
  it('is the first letter of each of the first two words, one letter for one word', () => {
    expect(initialsOf('Squad Chats')).toBe('SC');
    expect(initialsOf('Wallet')).toBe('W');
    expect(initialsOf('chat-eu')).toBe('CE');
    expect(initialsOf('my squad board')).toBe('MS');
    expect(initialsOf('   ')).toBe('');
  });
});

describe('thumbnail ground', () => {
  it('an image sits on a fill by default; padded on it, or on nothing, when asked', async () => {
    const { COMPONENTS_CSS } = await import('./components-css');
    expect(thumbnail({ label: 'Harbor', image: true })['data-ground']).toBeUndefined();
    expect(thumbnail({ label: 'Harbor', image: true, ground: 'padded' })['data-ground']).toBe('padded');
    expect(thumbnail({ label: 'Harbor', image: true, ground: 'none' })['data-ground']).toBe('none');
    expect(COMPONENTS_CSS).toMatch(/\[data-boogy="thumbnail"\]\[data-ground="padded"\][^{]*\{[^}]*padding:/);
    expect(COMPONENTS_CSS).toMatch(/\[data-ground="padded"\] > img \{[^}]*object-fit: contain/);
    expect(COMPONENTS_CSS).toMatch(/\[data-boogy="thumbnail"\]\[data-ground="none"\][^{]*\{[^}]*background: transparent/);
  });
});

