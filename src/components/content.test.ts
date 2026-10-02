import { describe, it, expect } from 'vitest';
import { notice, NOTICE_TONES } from './notice';
import { infoList } from './info-list';
import { detailHeader } from './detail-header';

describe('content attrs', () => {
  it('notice is neutral unless told otherwise, and refuses an unknown tone', () => {
    expect(notice()).toEqual({ 'data-boogy': 'notice', 'data-tone': 'neutral' });
    expect(notice({ tone: 'warning' })['data-tone']).toBe('warning');
    // @ts-expect-error — not a NoticeTone
    expect(() => notice({ tone: 'loud' })).toThrow(/neutral.*warning/);
    expect([...NOTICE_TONES]).toEqual(['neutral', 'warning', 'danger']);
  });
  it('info list and detail header name themselves', () => {
    expect(infoList()).toEqual({ 'data-boogy': 'info-list' });
    expect(detailHeader()).toEqual({ 'data-boogy': 'detail-header' });
  });
});
