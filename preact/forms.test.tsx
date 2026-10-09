import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { EmptyState, Sheet, TextArea, TextField } from './index';

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

describe('<TextField> size', () => {
  it('lg: the field that is the main thing on its surface', () => {
    const r = mount(<TextField label="How many" size="lg" value="1" onValueChange={() => {}} />);
    expect(r.querySelector('[data-boogy="field"]')!.getAttribute('data-size')).toBe('lg');
  });
});

describe('<TextArea>', () => {
  it('is a labelled multi-line field: label, control, message, as a TextField is', () => {
    const onValueChange = vi.fn();
    const r = mount(<TextArea label="Names" value="" onValueChange={onValueChange} message="One per line" />);
    const label = r.querySelector('label')!;
    const area = label.control as HTMLTextAreaElement;
    expect(area.tagName).toBe('TEXTAREA');
    expect(area.dataset.slot).toBe('control');
    expect(area.getAttribute('aria-describedby')).toBe(r.querySelector('[data-slot="message"]')!.id);
    act(() => { area.value = 'a\nb'; area.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(onValueChange).toHaveBeenCalledWith('a\nb');
  });

  it('shows at least its rows, however short its text', () => {
    const r = mount(<TextArea label="Names" rows={4} value="" onValueChange={() => {}} />);
    const area = r.querySelector('textarea')!;
    expect(area.getAttribute('rows')).toBe('4');
    expect(area.style.getPropertyValue('--field-rows')).toBe('4');
  });

  it('newlines={false}: one paragraph however it wraps, so Enter makes no line break', () => {
    const r = mount(<TextArea label="Title" newlines={false} value="" onValueChange={() => {}} />);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    r.querySelector('textarea')!.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    const open = mount(<TextArea label="Notes" value="" onValueChange={() => {}} />);
    const again = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    open.querySelector('textarea')!.dispatchEvent(again);
    expect(again.defaultPrevented).toBe(false);
  });

  it('invalid marks the control and the field; size lg as a TextField', () => {
    const r = mount(<TextArea label="Q" size="lg" invalid value="" onValueChange={() => {}} />);
    expect(r.querySelector('[data-boogy="field"]')!.getAttribute('data-size')).toBe('lg');
    expect(r.querySelector('[data-boogy="field"]')!.getAttribute('data-invalid')).toBe('true');
    expect(r.querySelector('textarea')!.getAttribute('aria-invalid')).toBe('true');
  });
});
