import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { EmptyState, Sheet, TextField } from './index';

afterEach(() => { document.body.replaceChildren(); });
function mount(node: preact.ComponentChild) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return root;
}

describe('<EmptyState>', () => {
  it('graphic, title, explanation and action, in that order; the graphic is decorative', () => {
    const r = mount(<EmptyState media={<svg />} title="Nothing yet" action={<button>Add</button>}>Add one to begin.</EmptyState>);
    const root = r.querySelector('[data-boogy="empty-state"]')!;
    expect([...root.children].map((c) => c.getAttribute('data-slot'))).toEqual(['media', 'title', 'description', 'action']);
    expect(root.querySelector('[data-slot="media"]')!.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('[data-slot="title"]')!.textContent).toBe('Nothing yet');
  });
  it('omits the slots it is not given', () => {
    const r = mount(<EmptyState title="Nothing yet" />);
    expect([...r.querySelector('[data-boogy="empty-state"]')!.children].map((c) => c.getAttribute('data-slot'))).toEqual(['title']);
  });
});

describe('<Sheet>', () => {
  it('a titled head, a body, and a foot that holds the actions', () => {
    const r = mount(<Sheet title="Add one" foot={<button>OK</button>}><p>form</p></Sheet>);
    const s = r.querySelector('[data-boogy="sheet"]')!;
    expect([...s.children].map((c) => c.getAttribute('data-slot'))).toEqual(['head', 'body', 'foot']);
    expect(s.querySelector('h1[data-slot="title"]')!.textContent).toBe('Add one');
    expect(s.querySelector('[data-slot="foot"] button')!.textContent).toBe('OK');
  });
  it('no head or foot unless given', () => {
    const r = mount(<Sheet><p>form</p></Sheet>);
    expect([...r.querySelector('[data-boogy="sheet"]')!.children].map((c) => c.getAttribute('data-slot'))).toEqual(['body']);
  });
});

describe('<TextField>', () => {
  it('a labelled input reporting each change', () => {
    const onValueChange = vi.fn();
    const r = mount(<TextField label="Handle" value="" onValueChange={onValueChange} />);
    const input = r.querySelector<HTMLInputElement>('[data-boogy="field"] > input[data-slot="control"]')!;
    expect(r.querySelector('label[data-slot="label"]')!.getAttribute('for')).toBe(input.id);
    act(() => { input.value = 'al'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(onValueChange).toHaveBeenCalledWith('al');
  });
  it('invalid: marked on the field and the input, and the message describes the input', () => {
    const r = mount(<TextField label="Handle" value="x" onValueChange={() => {}} invalid message="Too short" />);
    const input = r.querySelector<HTMLInputElement>('input')!;
    expect(r.querySelector('[data-boogy="field"]')!.getAttribute('data-invalid')).toBe('true');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toBe('Too short');
  });
  it('passes other input attributes through', () => {
    const r = mount(<TextField label="Handle" value="" onValueChange={() => {}} placeholder="alice" autocomplete="off" />);
    const input = r.querySelector<HTMLInputElement>('input')!;
    expect(input.placeholder).toBe('alice');
    expect(input.getAttribute('autocomplete')).toBe('off');
  });
});
