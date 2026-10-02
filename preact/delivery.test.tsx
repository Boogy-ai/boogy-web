import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { Bubble, DeliveryMark, TypingBubble } from './index';

afterEach(() => { document.body.innerHTML = ''; });

function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  document.body.append(root);
  render(node, root);
  return root;
}

describe('delivery marks', () => {
  it('one check for sent, two for delivered and seen, each named for assistive tech', () => {
    for (const [status, label, paths] of [['sent', 'Sent', 1], ['delivered', 'Delivered', 2], ['seen', 'Seen', 2]] as const) {
      const r = mount(<DeliveryMark status={status} />);
      const mark = r.querySelector('[data-boogy="delivery-mark"]')!;
      expect(mark.getAttribute('data-status')).toBe(status);
      expect(mark.getAttribute('aria-label')).toBe(label);
      expect(mark.getAttribute('role')).toBe('img');
      expect(mark.querySelectorAll('svg path')).toHaveLength(paths);
    }
  });

  it("a bubble's status sits in its meta, after the time", () => {
    const r = mount(<Bubble side="end" meta="14:02" status="seen">hi</Bubble>);
    const meta = r.querySelector('[data-slot="meta"]')!;
    expect(meta.textContent).toContain('14:02');
    expect(meta.lastElementChild!.getAttribute('data-boogy')).toBe('delivery-mark');
  });

  it('a bubble with a status and no time still shows the mark', () => {
    const r = mount(<Bubble side="end" status="sent">hi</Bubble>);
    expect(r.querySelector('[data-slot="meta"] [data-boogy="delivery-mark"]')).toBeTruthy();
  });

  it('a bubble with neither has no meta at all', () => {
    const r = mount(<Bubble side="start">hi</Bubble>);
    expect(r.querySelector('[data-slot="meta"]')).toBeNull();
  });
});

describe('<TypingBubble>', () => {
  it('is a start-side bubble of three dots, announced politely', () => {
    const r = mount(<TypingBubble label="dave is typing" />);
    const b = r.querySelector('[data-boogy="bubble"]')!;
    expect(b.getAttribute('data-side')).toBe('start');
    expect(b.getAttribute('data-typing')).toBe('true');
    expect(b.getAttribute('role')).toBe('status');
    expect(b.getAttribute('aria-label')).toBe('dave is typing');
    expect(b.querySelectorAll('[data-slot="dot"]')).toHaveLength(3);
  });
});
