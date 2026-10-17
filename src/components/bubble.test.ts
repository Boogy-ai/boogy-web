import { describe, it, expect } from 'vitest';
import { bubble, thread, BUBBLE_SIDES } from './bubble';
import { notice } from './notice';
import { ruleFor } from '../../test-support/rule-for';
import { COMPONENTS_CSS } from './components-css';
import { FOUNDATION_CSS } from '../layout/foundation-css';

const token = (name: string) => FOUNDATION_CSS.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1];


describe('bubble', () => {
  it('a message on one side of a thread: start (theirs) by default, or end (yours)', () => {
    expect(BUBBLE_SIDES).toEqual(['start', 'end']);
    expect(bubble()).toEqual({ 'data-boogy': 'bubble', 'data-side': 'start' });
    expect(bubble({ side: 'end' })).toEqual({ 'data-boogy': 'bubble', 'data-side': 'end' });
    expect(() => bubble({ side: 'left' as never })).toThrow(/side/);
  });
  it('sits on its side of the thread, no wider than most of it', () => {
    const r = ruleFor('[data-boogy="bubble"]');
    expect(r).toContain('align-self: flex-start');
    expect(r).toContain('max-width: 80%');
    expect(ruleFor('[data-boogy="bubble"][data-side="end"]')).toContain('align-self: flex-end');
  });
  it('keeps the line breaks it was written with, and wraps a long word', () => {
    const r = ruleFor('[data-boogy="bubble"] > [data-slot="body"]');
    expect(r).toContain('white-space: pre-wrap');
    expect(r).toContain('overflow-wrap: anywhere');
  });
  it('theirs on a faint fill with a faint edge; yours on the soft accent; both in the ink', () => {
    const theirs = ruleFor('[data-boogy="bubble"] > [data-slot="body"]');
    expect(theirs).toContain('background: var(--bubble-ground-start)');
    expect(theirs).toContain('border: 1px solid var(--edge)');
    expect(theirs).toContain('color: var(--text-1)');
    const yours = ruleFor('[data-boogy="bubble"][data-side="end"] > [data-slot="body"]');
    expect(yours).toContain('background: var(--bubble-ground-end)');
    expect(yours).toContain('border-color: transparent');
  });
  it('each ground a notch more solid than the hover fill and the soft accent, so a bubble holds over a busy background', () => {
    expect(token('--bubble-ground-start')).toBe('color-mix(in oklch, var(--text-1) 8%, transparent)');
    expect(token('--fill-hover')).toBe('color-mix(in oklch, var(--text-1) 6%, transparent)');
    expect(token('--bubble-ground-end')).toBe('oklch(from var(--accent) l c h / 0.2)');
    expect(token('--accent-soft')).toBe('oklch(from var(--accent) l c h / 0.16)');
  });
  it("its foot corner on the sender's side is nearly square, pointing at whose it is", () => {
    // Logical corners: bottom left for theirs and bottom right for yours in
    // left-to-right text, mirrored in right-to-left.
    expect(ruleFor('[data-boogy="bubble"] > [data-slot="body"]')).toContain('border-radius: var(--radius-3)');
    expect(ruleFor('[data-boogy="bubble"][data-side="start"] > [data-slot="body"]')).toContain('border-end-start-radius: var(--radius-1)');
    expect(ruleFor('[data-boogy="bubble"][data-side="end"] > [data-slot="body"]')).toContain('border-end-end-radius: var(--radius-1)');
    expect(ruleFor('[data-boogy="bubble"][data-side="end"] > [data-slot="body"]')).not.toContain('border-end-start-radius');
  });
  it('its time beneath, small and dim, on its side', () => {
    const m = ruleFor('[data-boogy="bubble"] > [data-slot="meta"]');
    expect(m).toContain('color: var(--text-3)');
    expect(m).toContain('font-size: var(--fs-caption)');
    expect(ruleFor('[data-boogy="bubble"][data-side="end"]')).toContain('align-items: flex-end');
  });
});

describe('thread', () => {
  it('casts a subtle shadow under every bubble in it, when asked', () => {
    expect(thread({ shadow: true })).toEqual({ 'data-boogy': 'thread', 'data-shadow': '' });
    expect(thread({ shadow: false })).toEqual({ 'data-boogy': 'thread' });
    expect(ruleFor('[data-boogy="thread"][data-shadow] [data-boogy="bubble"] > [data-slot="body"]')).toContain('box-shadow: var(--bubble-shadow)');
    expect(ruleFor('[data-boogy="bubble"] > [data-slot="body"]')).not.toContain('box-shadow');
  });
  it('marks a column of bubbles', () => {
    expect(thread()).toEqual({ 'data-boogy': 'thread' });
    const r = ruleFor('[data-boogy="thread"]');
    expect(r).toContain('display: flex');
    expect(r).toContain('flex-direction: column');
    expect(r).toContain('gap: var(--thread-gap, var(--space-2))');
  });
});

describe('a multi-line field', () => {
  it('a textarea in a field group grows with its text, up to eight lines, never resized by hand', () => {
    const r = ruleFor('[data-boogy="field"] > [data-slot="group"] > textarea[data-slot="control"]');
    expect(r).toContain('field-sizing: content');
    expect(r).toContain('max-height: calc(7lh + var(--control-md))');
    expect(r).toContain('resize: none');
  });
  it('what sits beside it (a send button) stays at its bottom as it grows', () => {
    expect(ruleFor('[data-boogy="field"] > [data-slot="group"]:has(> textarea)')).toContain('align-items: flex-end');
  });
});

describe('notice danger', () => {
  it('a third tone, for something that went wrong', () => {
    expect(notice({ tone: 'danger' })).toEqual({ 'data-boogy': 'notice', 'data-tone': 'danger' });
    expect(ruleFor('[data-boogy="notice"][data-tone="danger"]')).toContain('color: var(--danger)');
  });
});

describe('sheet head', () => {
  it('a title may carry media beside its text (an avatar by a name)', () => {
    const r = ruleFor('[data-boogy="sheet"] > [data-slot="head"] > [data-slot="title"]');
    expect(r).toContain('display: flex');
    expect(r).toContain('align-items: center');
    expect(r).toContain('min-width: 0');
  });
});

describe('sheet foot', () => {
  it('a field in the foot (a composer) takes the foot\'s width', () => {
    expect(ruleFor('[data-boogy="sheet"] > [data-slot="foot"] > [data-boogy="field"]')).toContain('flex: 1 1 auto');
  });
});

describe('a field group with nothing before its control', () => {
  it('pads the control at its start too, so text is never flush with the frame', () => {
    expect(ruleFor('[data-boogy="field"] > [data-slot="group"] > [data-slot="control"]:first-child')).toContain('padding-inline-start: var(--space-2)');
  });
});

describe('beside a multi-line field', () => {
  it('the suffix is one line tall inside the frame, its content centred: centred on one line, at the bottom as it grows', () => {
    const r = ruleFor('[data-boogy="field"] > [data-slot="group"]:has(> textarea) > [data-slot="suffix"]');
    // One line of the field: the group is content-box, so inside its border
    // it is exactly the control height.
    expect(r).toContain('block-size: var(--control-md)');
    expect(r).toContain('align-items: center');
  });
});

describe('a composer in a sheet foot is the whole bar', () => {
  it('the foot is a light, frosted well (--composer-ground), and its top edge shows focus', () => {
    expect(ruleFor('[data-boogy="sheet"] > [data-slot="foot"]:has(> [data-boogy="field"])')).toContain('background: var(--composer-ground)');
    expect(ruleFor('[data-boogy="sheet"] > [data-slot="foot"]:has(> [data-boogy="field"]):focus-within')).toContain('border-top-color: var(--accent)');
  });
  it("the field's own frame dissolves into it: no border, background, corners, shadow or ring", () => {
    const r = ruleFor('[data-boogy="sheet"] > [data-slot="foot"] > [data-boogy="field"] > [data-slot="group"]');
    for (const d of ['border: none', 'background: transparent', 'border-radius: 0', 'box-shadow: none']) expect(r).toContain(d);
    expect(ruleFor('[data-boogy="sheet"] > [data-slot="foot"] > [data-boogy="field"] > [data-slot="group"]:focus-within')).toContain('outline: none');
  });
});

describe('delivery marks and typing CSS', () => {
  it('lays the mark beside the time and colours "seen" with the accent', () => {
    expect(ruleFor('[data-boogy="bubble"] > [data-slot="meta"]')).toMatch(/display: inline-flex/);
    expect(ruleFor('[data-boogy="delivery-mark"]')).toMatch(/display: inline-flex/);
    expect(ruleFor('[data-boogy="delivery-mark"][data-status="seen"]')).toMatch(/color: var\(--accent\)/);
  });
  it('pulses the typing dots, and stills them under reduced motion', () => {
    expect(ruleFor('[data-boogy="bubble"][data-typing="true"] [data-slot="dot"]')).toMatch(/animation: boogy-typing/);
    expect(COMPONENTS_CSS).toMatch(/@keyframes boogy-typing/);
    expect(COMPONENTS_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\[data-boogy="bubble"\]\[data-typing="true"\] \[data-slot="dot"\] \{ animation: none; \}/);
  });
});
