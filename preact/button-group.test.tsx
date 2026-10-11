import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { Button, ButtonGroup, Glyph } from './index';

afterEach(() => { document.body.innerHTML = ''; });
function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  document.body.append(root);
  act(() => render(node, root));
  return root;
}

describe('<ButtonGroup>', () => {
  it('is a group named by its label, holding its buttons untouched', () => {
    const root = mount(
      <ButtonGroup label="History" rounded>
        <Button variant="soft" shape="icon" rounded label="Back"><Glyph shape="back" /></Button>
        <Button variant="soft" shape="icon" rounded label="Forward" disabled><Glyph shape="forward" /></Button>
      </ButtonGroup>,
    );
    const g = root.querySelector('[data-boogy="button-group"]')!;
    expect(g.getAttribute('role')).toBe('group');
    expect(g.getAttribute('aria-label')).toBe('History');
    expect(g.getAttribute('data-rounded')).toBe('true');
    const [a, b] = [...g.children] as HTMLButtonElement[];
    expect(a.getAttribute('aria-label')).toBe('Back');
    expect(a.getAttribute('data-variant')).toBe('soft');
    expect(b.disabled).toBe(true);
    expect(g.children).toHaveLength(2);
  });
  it('is not rounded unless asked', () => {
    const root = mount(<ButtonGroup label="x"><Button>A</Button><Button>B</Button></ButtonGroup>);
    expect(root.querySelector('[data-boogy="button-group"]')!.hasAttribute('data-rounded')).toBe(false);
  });
});
