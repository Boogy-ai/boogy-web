import { describe, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { Sheet } from './index';

function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  act(() => render(node, root));
  return root.firstElementChild as HTMLElement;
}
const head = (el: HTMLElement) => el.querySelector(':scope > [data-slot="head"]') as HTMLElement;

describe('<Sheet> head', () => {
  it("onBack: a Back button first in the head, drawn with the SDK's chevron at a token size", () => {
    const onBack = vi.fn();
    const el = mount(<Sheet title="Dave" onBack={onBack} backLabel="Back to buddies">x</Sheet>);
    const first = head(el).firstElementChild as HTMLButtonElement;
    expect(first.tagName).toBe('BUTTON');
    expect(first.getAttribute('aria-label')).toBe('Back to buddies');
    const glyph = first.querySelector('svg')!;
    expect(glyph.getAttribute('data-boogy')).toBe('glyph');
    expect(glyph.getAttribute('width')).toBeNull();
    act(() => first.click());
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('the Back button is named "Back" by default', () => {
    const el = mount(<Sheet title="T" onBack={() => {}}>x</Sheet>);
    expect(head(el).firstElementChild!.getAttribute('aria-label')).toBe('Back');
  });

  it('end: a bar after the title, at the end of the head', () => {
    const el = mount(<Sheet title="T" end={<button>A</button>}>x</Sheet>);
    const kids = [...head(el).children];
    expect(kids.map((k) => k.getAttribute('data-slot'))).toEqual(['title', 'end']);
    expect(kids[1].querySelector('button')!.textContent).toBe('A');
  });

  it('without onBack or end, the head is the title alone', () => {
    const el = mount(<Sheet title="T">x</Sheet>);
    expect([...head(el).children].map((k) => k.getAttribute('data-slot'))).toEqual(['title']);
  });
});
