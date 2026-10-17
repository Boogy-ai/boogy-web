import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { ImageField, TextArea, TextField } from './index';

afterEach(() => { document.body.replaceChildren(); });
function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return root;
}
const settle = async () => { await act(async () => { for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0)); }); };
function pick(root: HTMLElement, file: File) {
  const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  act(() => { input.dispatchEvent(new Event('change', { bubbles: true })); });
}
const png = (bytes: number) => new File([new Uint8Array(bytes)], 'logo.png', { type: 'image/png' });

describe('<ImageField>', () => {
  it("shows the image, or the name's initials; Upload opens a picker of the accepted types", () => {
    const root = mount(<ImageField label="Logo" name="Harbor Lane" src={null} onPick={() => {}} onRemove={() => {}} />);
    expect(root.querySelector('[data-boogy="thumbnail"]')!.textContent).toBe('HL');
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toBe('image/png,image/jpeg,image/webp');
    const click = vi.spyOn(input, 'click');
    act(() => root.querySelector<HTMLButtonElement>('[data-action="upload"]')!.click());
    expect(click).toHaveBeenCalled();
    expect(root.querySelector('[data-action="upload"]')!.textContent).toBe('Upload image');
    // Nothing to remove yet.
    expect(root.querySelector('[data-action="remove"]')).toBeNull();
  });

  it('a file of another type, or too large, is refused here, saying why', () => {
    const onPick = vi.fn();
    const root = mount(<ImageField label="Logo" name="Harbor Lane" src={null} maxBytes={2 * 1024 * 1024} onPick={onPick} />);
    pick(root, new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }));
    expect(root.querySelector('[data-slot="message"]')!.textContent).toBe('Choose a PNG, JPEG or WebP image.');
    // Said aloud: a refusal is news, not a hint read on focus.
    expect(root.querySelector('[data-slot="message"]')!.getAttribute('role')).toBe('alert');
    expect(root.querySelector('[data-boogy="field"]')!.getAttribute('data-invalid')).toBe('true');
    pick(root, png(3.2 * 1024 * 1024));
    expect(root.querySelector('[data-slot="message"]')!.textContent).toBe('That image is 3.2 MB; the most is 2 MB.');
    expect(onPick).not.toHaveBeenCalled();
  });

  it('a good one is handed over, the field busy until it is taken; a failure says why', async () => {
    let finish: (v?: unknown) => void = () => {};
    const onPick = vi.fn(() => new Promise((r) => { finish = r; }));
    const root = mount(<ImageField label="Logo" name="Harbor Lane" src={null} message="PNG, JPEG or WebP." onPick={onPick} />);
    const file = png(1000);
    pick(root, file);
    expect(onPick).toHaveBeenCalledWith(file);
    const upload = root.querySelector<HTMLButtonElement>('[data-action="upload"]')!;
    expect(upload.textContent).toBe('Uploading…');
    expect(upload.disabled).toBe(true);
    await act(async () => { finish(); });
    await settle();
    expect(upload.textContent).toBe('Upload image');
    expect(root.querySelector('[data-slot="message"]')!.textContent).toBe('PNG, JPEG or WebP.');
    onPick.mockImplementationOnce(() => Promise.reject(new Error('There is no room left to store it.')));
    pick(root, file);
    await settle();
    expect(root.querySelector('[data-slot="message"]')!.textContent).toBe('There is no room left to store it.');
  });

  it('with an image, Remove takes it off', async () => {
    const onRemove = vi.fn(async () => {});
    const root = mount(<ImageField label="Logo" name="Harbor Lane" src="/files/logo.png" onPick={() => {}} onRemove={onRemove} />);
    expect(root.querySelector('[data-boogy="thumbnail"] img')!.getAttribute('src')).toBe('/files/logo.png');
    await act(async () => { root.querySelector<HTMLButtonElement>('[data-action="remove"]')!.click(); });
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('<ImageField> background', () => {
  it('a switch puts the image on a padded background, or on none; the image shows it', () => {
    const onGroundChange = vi.fn();
    const root = mount(<ImageField label="Logo" name="Harbor" src="/files/logo.png" onPick={() => {}} ground="padded" onGroundChange={onGroundChange} />);
    expect(root.querySelector('[data-boogy="thumbnail"]')!.getAttribute('data-ground')).toBe('padded');
    const toggle = root.querySelector<HTMLButtonElement>('[data-boogy="switch"]')!;
    expect(toggle.textContent).toContain('Background');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    act(() => toggle.click());
    expect(onGroundChange).toHaveBeenCalledWith('none');
  });
});

describe('a field with a limit counts what is typed', () => {
  it('the count is in characters, as a person counts them (an emoji is one)', () => {
    const root = mount(<TextField label="Name" value="Hi 🙂🙂" onValueChange={() => {}} maxLength={10} />);
    expect(root.querySelector('[data-slot="count"]')!.textContent).toBe('5 / 10');
  });

  it('past the limit the field says so and keeps what was typed (pasted text is edited down, not cut)', () => {
    const root = mount(<TextArea label="Description" value={'x'.repeat(12)} onValueChange={() => {}} maxLength={10} />);
    const field = root.querySelector('[data-boogy="field"]')!;
    expect(field.getAttribute('data-invalid')).toBe('true');
    expect(root.querySelector('textarea')!.hasAttribute('maxlength')).toBe(false);
    expect(root.querySelector('[data-slot="count"]')!.textContent).toBe('12 / 10');
  });

  it('TextArea and TextField show how much of the limit is used', () => {
    const root = mount(<>
      <TextArea label="Description" value="Design crew" onValueChange={() => {}} maxLength={200} message="Shown on the room list." />
      <TextField label="Name" value="Harbor" onValueChange={() => {}} maxLength={60} />
    </>);
    const [area, name] = [...root.querySelectorAll('[data-boogy="field"]')];
    expect(area.querySelector('[data-slot="count"]')!.textContent).toBe('11 / 200');
    expect(area.querySelector('[data-slot="message"]')!.textContent).toContain('Shown on the room list.');
    expect(name.querySelector('[data-slot="count"]')!.textContent).toBe('6 / 60');
    // Read with the field, as its description.
    const input = name.querySelector('input')!;
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toContain('6 / 60');
  });
});
