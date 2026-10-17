import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { Panel } from './index';

afterEach(() => { document.body.replaceChildren(); });
function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return root;
}

describe('<Panel>', () => {
  it('a named region: its head, then the body that scrolls, then its foot', () => {
    const root = mount(<Panel label="Members" head={<h3 id="h">Members</h3>} foot={<button id="f">Invite</button>} grow><p id="b" /></Panel>);
    const el = root.querySelector('[data-boogy="panel"]')!;
    expect(el.tagName).toBe('SECTION');
    expect(el.getAttribute('aria-label')).toBe('Members');
    expect(el.getAttribute('data-grow')).toBe('true');
    expect([...el.children].map((c) => c.getAttribute('data-slot'))).toEqual(['head', 'body', 'foot']);
    expect(el.querySelector('[data-slot="head"] > #h')).not.toBeNull();
    expect(el.querySelector('[data-slot="body"] > #b')).not.toBeNull();
    expect(el.querySelector('[data-slot="foot"] > #f')).not.toBeNull();
  });
  it('with no head or foot, only the body', () => {
    const root = mount(<Panel label="Links"><p /></Panel>);
    const el = root.querySelector('[data-boogy="panel"]')!;
    expect([...el.children].map((c) => c.getAttribute('data-slot'))).toEqual(['body']);
    expect(el.hasAttribute('data-grow')).toBe(false);
  });
});
