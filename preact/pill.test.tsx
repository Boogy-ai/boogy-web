import { describe, it, expect } from 'vitest';
import { render } from 'preact';
import { Pill } from './index';

function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  render(node, root);
  return root.firstElementChild as HTMLElement;
}

describe('<Pill>', () => {
  it('is a span by default, holding its children, with the solid variant', () => {
    const el = mount(<Pill><i>icon</i><span>Title</span></Pill>);
    expect(el.tagName).toBe('SPAN');
    expect(el.dataset.boogy).toBe('pill');
    expect(el.dataset.variant).toBe('solid');
    expect(el.textContent).toBe('iconTitle');
  });

  it('renders as the element it is asked for, passing its props through', () => {
    let clicked = false;
    const el = mount(
      <Pill as="button" type="button" variant="ghost" class="mine" aria-label="Change" onClick={() => { clicked = true; }}>x</Pill>,
    );
    expect(el.tagName).toBe('BUTTON');
    expect(el.dataset.variant).toBe('ghost');
    expect(el.className).toBe('mine');
    expect(el.getAttribute('aria-label')).toBe('Change');
    el.click();
    expect(clicked).toBe(true);
  });

  it('switching the variant prop switches the look, and nothing else', () => {
    const root = document.createElement('div');
    render(<Pill variant="transparent">x</Pill>, root);
    const el = root.firstElementChild as HTMLElement;
    render(<Pill variant="solid">x</Pill>, root);
    expect(root.firstElementChild).toBe(el); // same element, not a remount
    expect(el.dataset.variant).toBe('solid');
  });
});
