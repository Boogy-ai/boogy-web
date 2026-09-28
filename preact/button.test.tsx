import { describe, it, expect } from 'vitest';
import { render } from 'preact';
import { Button } from './index';

function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  render(node, root);
  return root.firstElementChild as HTMLElement;
}

describe('<Button>', () => {
  it('is a real button of type=button by default, quiet and medium', () => {
    const el = mount(<Button>Go</Button>);
    expect(el.tagName).toBe('BUTTON');
    expect(el.getAttribute('type')).toBe('button');
    expect(el.dataset.variant).toBe('quiet');
    expect(el.dataset.size).toBe('md');
  });

  it('an icon button carries its label as the accessible name and the tooltip', () => {
    const el = mount(<Button shape="icon" label="Delete board"><i /></Button>);
    expect(el.dataset.shape).toBe('icon');
    expect(el.getAttribute('aria-label')).toBe('Delete board');
    expect(el.getAttribute('title')).toBe('Delete board');
  });

  it('can be a link styled as a button, with no button type', () => {
    const el = mount(<Button as="a" href="/x" variant="solid" rounded>Open</Button>);
    expect(el.tagName).toBe('A');
    expect(el.getAttribute('href')).toBe('/x');
    expect(el.hasAttribute('type')).toBe(false);
    expect(el.dataset.rounded).toBe('true');
  });

  it('passes other props through', () => {
    let hit = 0;
    const el = mount(<Button variant="danger" class="mine" onClick={() => { hit++; }}>Delete</Button>);
    el.click();
    expect(hit).toBe(1);
    expect(el.className).toBe('mine');
  });
});

describe('<Button> ref', () => {
  it('reaches the real element, so a caller can focus it', () => {
    let el: HTMLElement | null = null;
    const root = document.createElement('div');
    render(<Button ref={(e: HTMLElement | null) => { el = e; }}>Go</Button>, root);
    expect(el).toBe(root.firstElementChild);
  });
});

// Type-level: an icon button without a label must not compile.
// @ts-expect-error — shape="icon" requires label
export const missingLabel = <Button shape="icon"><i /></Button>;
