import { describe, it, expect } from 'vitest';
import { place, parsePlacement, popover } from './popover';

// A 1000 x 800 viewport; a 100 x 40 trigger; a 200 x 300 popup, unless a case
// says otherwise. Defaults are React Aria's: offset 8, crossOffset 0,
// containerPadding 12, flip on.
const viewport = { width: 1000, height: 800 };
const trigger = (left: number, top: number, width = 100, height = 40) => ({ left, top, width, height });
const popup = { width: 200, height: 300 };

describe('parsePlacement', () => {
  it('reads "side align", defaulting the alignment to center', () => {
    expect(parsePlacement('bottom')).toEqual({ side: 'bottom', align: 'center' });
    expect(parsePlacement('bottom start')).toEqual({ side: 'bottom', align: 'start' });
    expect(parsePlacement('top end')).toEqual({ side: 'top', align: 'end' });
    expect(parsePlacement('left top')).toEqual({ side: 'left', align: 'start' });
    expect(parsePlacement('right bottom')).toEqual({ side: 'right', align: 'end' });
    expect(parsePlacement('bottom left')).toEqual({ side: 'bottom', align: 'start' });
    expect(parsePlacement('bottom right')).toEqual({ side: 'bottom', align: 'end' });
  });
  it('reads start and end as sides in a left-to-right document', () => {
    expect(parsePlacement('start')).toEqual({ side: 'left', align: 'center' });
    expect(parsePlacement('end top')).toEqual({ side: 'right', align: 'start' });
  });
});

describe('place', () => {
  it('bottom: below the trigger by the offset, centred on it', () => {
    const r = place({ trigger: trigger(400, 100), popup, viewport });
    expect(r).toMatchObject({ placement: 'bottom', x: 350, y: 148 });
  });

  it('aligns to the start or end edge of the trigger, plus the cross offset', () => {
    expect(place({ trigger: trigger(400, 100), popup, viewport, placement: 'bottom start' }).x).toBe(400);
    expect(place({ trigger: trigger(400, 100), popup, viewport, placement: 'bottom end' }).x).toBe(300);
    expect(place({ trigger: trigger(400, 100), popup, viewport, placement: 'bottom start', crossOffset: 10 }).x).toBe(410);
  });

  it('top, left and right sit on their sides by the offset', () => {
    expect(place({ trigger: trigger(400, 500), popup, viewport, placement: 'top' })).toMatchObject({ placement: 'top', y: 500 - 8 - 300 });
    expect(place({ trigger: trigger(400, 300), popup, viewport, placement: 'left' })).toMatchObject({ placement: 'left', x: 400 - 8 - 200 });
    expect(place({ trigger: trigger(400, 300), popup, viewport, placement: 'right' })).toMatchObject({ placement: 'right', x: 508 });
  });

  it('flips to the opposite side when it does not fit and the other side has more room', () => {
    // 600 above, 800 - 740 - 8 - 12 = 40 below: flips up.
    const r = place({ trigger: trigger(400, 700), popup, viewport });
    expect(r.placement).toBe('top');
    expect(r.y).toBe(700 - 8 - 300);
  });

  it('does not flip when the opposite side has no more room', () => {
    // A 780-tall popup fits nowhere; below (800-140-20=640) beats above (100-20=80).
    const r = place({ trigger: trigger(400, 100), popup: { width: 200, height: 780 }, viewport });
    expect(r.placement).toBe('bottom');
  });

  it('never flips when shouldFlip is false', () => {
    expect(place({ trigger: trigger(400, 700), popup, viewport, shouldFlip: false }).placement).toBe('bottom');
  });

  it('only ever flips to the OPPOSITE side, never a perpendicular one (as React Aria)', () => {
    // Right edge, placement right: flips left, not up or down.
    const r = place({ trigger: trigger(880, 300), popup, viewport, placement: 'right' });
    expect(r.placement).toBe('left');
  });

  it('slides along the edge to stay containerPadding inside the viewport', () => {
    // Centred under a trigger at the left edge would start at -50: pulled to 12.
    expect(place({ trigger: trigger(0, 100), popup, viewport }).x).toBe(12);
    // At the right edge: pulled back so its right side is 12 from the edge.
    expect(place({ trigger: trigger(950, 100), popup, viewport }).x).toBe(1000 - 12 - 200);
    // containerPadding is configurable.
    expect(place({ trigger: trigger(0, 100), popup, viewport, containerPadding: 4 }).x).toBe(4);
  });

  it('slides vertically for a side placement near the top or bottom', () => {
    expect(place({ trigger: trigger(400, 0), popup, viewport, placement: 'right' }).y).toBe(12);
    expect(place({ trigger: trigger(400, 780, 100, 20), popup, viewport, placement: 'right' }).y).toBe(800 - 12 - 300);
  });

  it('a popup wider than the viewport is pinned to the start padding', () => {
    expect(place({ trigger: trigger(400, 100), popup: { width: 1200, height: 100 }, viewport }).x).toBe(12);
  });

  it('caps maxHeight to the room on its side, so a tall popup scrolls instead of leaving the screen', () => {
    const below = place({ trigger: trigger(400, 100), popup: { width: 200, height: 780 }, viewport });
    expect(below.maxHeight).toBe(800 - 148 - 12);
    const above = place({ trigger: trigger(400, 700), popup: { width: 200, height: 780 }, viewport, placement: 'top' });
    expect(above.placement).toBe('top');
    expect(above.maxHeight).toBe(700 - 8 - 12);
    // A capped popup placed above still ends at the offset above the trigger.
    expect(above.y).toBe(12);
  });

  it('a side placement measures its room from its own top, after sliding (as React Aria)', () => {
    // Centred on the trigger: top = 320 - 150 = 170, so 800 - 170 - 12.
    expect(place({ trigger: trigger(400, 300), popup, viewport, placement: 'right' }).maxHeight).toBe(618);
    // Aligned to the trigger's bottom, it grows upward: its bottom less the padding.
    const up = place({ trigger: trigger(400, 500), popup, viewport, placement: 'right bottom' });
    expect(up.maxHeight).toBe(540 - 12);
  });

  it('a maxHeight the caller sets wins when it is smaller', () => {
    expect(place({ trigger: trigger(400, 100), popup, viewport, maxHeight: 200 }).maxHeight).toBe(200);
    expect(place({ trigger: trigger(400, 100), popup, viewport, maxHeight: 5000 }).maxHeight).toBe(800 - 148 - 12);
  });

  it('never reports a negative maxHeight', () => {
    expect(place({ trigger: trigger(400, 790, 100, 10), popup, viewport, shouldFlip: false }).maxHeight).toBe(0);
  });
});

describe('popover()', () => {
  it('marks the element, its mode and the side it landed on', () => {
    expect(popover({ mode: 'anchored', placement: 'top' })).toEqual({
      'data-boogy': 'popover', 'data-mode': 'anchored', 'data-placement': 'top',
    });
    expect(popover({ mode: 'page' })).toEqual({ 'data-boogy': 'popover', 'data-mode': 'page' });
  });
});
