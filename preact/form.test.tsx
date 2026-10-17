import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { ActionButton, Form, ImageField } from './index';

afterEach(() => { document.body.replaceChildren(); });
function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return root;
}
const settle = async () => { await act(async () => { for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0)); }); };

describe('<ActionButton>', () => {
  it('a kind is its words, its look and its role; the words can be the caller\'s', () => {
    const root = mount(<><ActionButton kind="save" /><ActionButton kind="cancel" /><ActionButton kind="delete">Delete room</ActionButton></>);
    const [save, cancel, del] = [...root.querySelectorAll('button')];
    expect(save.textContent).toBe('Save');
    expect(save.dataset.variant).toBe('solid');
    expect(save.getAttribute('type')).toBe('submit');
    expect(save.dataset.role).toBe('primary');
    expect(cancel.textContent).toBe('Cancel');
    expect(cancel.dataset.variant).toBe('quiet');
    expect(cancel.getAttribute('type')).toBe('button');
    expect(del.textContent).toBe('Delete room');
    expect(del.dataset.variant).toBe('danger');
    expect(del.dataset.role).toBe('destructive');
    expect(del.querySelector('svg')).not.toBeNull();
  });

  it('busy, it says so and cannot be pressed again', () => {
    const root = mount(<ActionButton kind="save" busy />);
    const b = root.querySelector('button')!;
    expect(b.textContent).toBe('Saving…');
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('aria-busy')).toBe('true');
  });
});

describe('<Form>', () => {
  it('submits once, every action held meanwhile (a Cancel then would race the save), the primary saying so', async () => {
    let finish: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((r) => { finish = r; }));
    const onCancel = vi.fn();
    const root = mount(
      <Form onSubmit={onSubmit} actions={<><ActionButton kind="cancel" onClick={onCancel} /><ActionButton kind="save" /></>}>
        <input aria-label="Name" />
      </Form>,
    );
    const form = root.querySelector('form')!;
    expect(form.dataset.boogy).toBe('form');
    const save = root.querySelector<HTMLButtonElement>('[data-action="save"]')!;
    act(() => save.click());
    act(() => save.click());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(save.textContent).toBe('Saving…');
    expect(save.disabled).toBe(true);
    expect(form.getAttribute('aria-busy')).toBe('true');
    const cancel = root.querySelector<HTMLButtonElement>('[data-action="cancel"]')!;
    expect(cancel.disabled).toBe(true);
    expect(cancel.textContent).toBe('Cancel');
    await act(async () => { finish(); });
    await settle();
    expect(save.textContent).toBe('Save');
    expect(save.disabled).toBe(false);
    expect(cancel.disabled).toBe(false);
    act(() => cancel.click());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('a submit that fails says why in its foot, until the next try', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('That name is taken.')).mockResolvedValueOnce(undefined);
    const root = mount(<Form onSubmit={onSubmit} actions={<ActionButton kind="save" />}><input aria-label="Name" /></Form>);
    act(() => root.querySelector<HTMLButtonElement>('[data-action="save"]')!.click());
    await settle();
    const notice = root.querySelector('[data-slot="foot"] [data-boogy="notice"]');
    expect(notice?.textContent).toContain('That name is taken.');
    act(() => root.querySelector<HTMLButtonElement>('[data-action="save"]')!.click());
    await settle();
    expect(root.querySelector('[data-slot="foot"] [data-boogy="notice"]')).toBeNull();
  });

  it('its fields are in a body that scrolls, its actions in a foot', () => {
    const root = mount(<Form onSubmit={() => {}} actions={<ActionButton kind="save" />}><input aria-label="Name" /></Form>);
    expect(root.querySelector('form > [data-slot="body"] > [data-slot="fields"] input')).not.toBeNull();
    expect(root.querySelector('form > [data-slot="foot"] > [data-slot="actions"] [data-action="save"]')).not.toBeNull();
  });
});

describe('<Form> and the work of its fields', () => {
  it('waits for an image still uploading: Save is held and Enter submits nothing until it is in', async () => {
    let finish: () => void = () => {};
    const onSubmit = vi.fn();
    const onPick = vi.fn(() => new Promise<void>((r) => { finish = r; }));
    const root = mount(
      <Form onSubmit={onSubmit} actions={<ActionButton kind="save" />}>
        <ImageField label="Logo" name="Harbor" src={null} onPick={onPick} />
        <input aria-label="Name" />
      </Form>,
    );
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [new File([new Uint8Array(10)], 'a.png', { type: 'image/png' })], configurable: true });
    act(() => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    const save = root.querySelector<HTMLButtonElement>('[data-action="save"]')!;
    expect(save.disabled).toBe(true);
    act(() => { root.querySelector('form')!.requestSubmit(); });
    expect(onSubmit).not.toHaveBeenCalled();
    await act(async () => { finish(); });
    await settle();
    expect(save.disabled).toBe(false);
    act(() => save.click());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

