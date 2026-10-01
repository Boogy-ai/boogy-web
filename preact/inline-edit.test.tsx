import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { InlineEdit } from './index';

afterEach(() => { document.body.replaceChildren(); });

function mount(node: preact.ComponentChild) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return { root, input: () => root.querySelector('input') as HTMLInputElement };
}
const type = (el: HTMLInputElement, text: string) =>
  act(() => { el.focus(); el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); });
const key = (el: HTMLInputElement, k: string) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });

describe('<InlineEdit>', () => {
  it('shows the value in a text field named by its label', () => {
    const { input } = mount(<InlineEdit value="Work" label="Board name" onCommit={() => {}} />);
    expect(input().value).toBe('Work');
    expect(input().getAttribute('aria-label')).toBe('Board name');
    expect(input().dataset.boogy).toBe('inline-edit');
  });
  it('Enter commits the trimmed text', () => {
    const onCommit = vi.fn();
    const { input } = mount(<InlineEdit value="Work" label="Name" onCommit={onCommit} />);
    type(input(), '  Home  ');
    key(input(), 'Enter');
    expect(onCommit).toHaveBeenCalledWith('Home');
    expect(input().value).toBe('Home');
  });
  it('leaving the field commits', () => {
    const onCommit = vi.fn();
    const { input } = mount(<InlineEdit value="Work" label="Name" onCommit={onCommit} />);
    type(input(), 'Home');
    act(() => input().blur());
    expect(onCommit).toHaveBeenCalledWith('Home');
  });
  it('Escape puts the text back and commits nothing', () => {
    const onCommit = vi.fn();
    const { input } = mount(<InlineEdit value="Work" label="Name" onCommit={onCommit} />);
    type(input(), 'Home');
    key(input(), 'Escape');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe('Work');
  });
  it('an emptied field reverts and commits nothing', () => {
    const onCommit = vi.fn();
    const { input } = mount(<InlineEdit value="Work" label="Name" onCommit={onCommit} />);
    type(input(), '   ');
    key(input(), 'Enter');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe('Work');
  });
  it('an unchanged value commits nothing', () => {
    const onCommit = vi.fn();
    const { input } = mount(<InlineEdit value="Work" label="Name" onCommit={onCommit} />);
    type(input(), 'Work');
    key(input(), 'Enter');
    expect(onCommit).not.toHaveBeenCalled();
  });
  it('takes a new value from outside when it is not being edited', () => {
    const { root, input } = mount(<InlineEdit value="Work" label="Name" onCommit={() => {}} />);
    act(() => render(<InlineEdit value="Renamed elsewhere" label="Name" onCommit={() => {}} />, root));
    expect(input().value).toBe('Renamed elsewhere');
  });
  it('Enter while an input method is composing confirms the composition, not the edit', () => {
    const onCommit = vi.fn();
    const { input } = mount(<InlineEdit value="Work" label="Name" onCommit={onCommit} />);
    type(input(), 'かいぎ');
    act(() => { input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })); });
    expect(onCommit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input());
  });
  it('Escape while composing cancels the composition, not the edit', () => {
    const onCommit = vi.fn();
    const { input } = mount(<InlineEdit value="Work" label="Name" onCommit={onCommit} />);
    type(input(), 'かいぎ');
    act(() => { input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 229, bubbles: true, cancelable: true })); });
    expect(input().value).toBe('かいぎ');
    expect(document.activeElement).toBe(input());
  });
  it('Enter commits exactly once, though it also leaves the field', () => {
    const onCommit = vi.fn();
    const { input } = mount(<InlineEdit value="Work" label="Name" onCommit={onCommit} />);
    type(input(), 'Home');
    key(input(), 'Enter');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
  it('a value changed from outside while editing leaves the text being typed alone', () => {
    const { root, input } = mount(<InlineEdit value="Work" label="Name" onCommit={() => {}} />);
    type(input(), 'Hom');
    act(() => render(<InlineEdit value="Renamed elsewhere" label="Name" onCommit={() => {}} />, root));
    expect(input().value).toBe('Hom');
  });
  it('cuts a commit to maxLength', () => {
    const onCommit = vi.fn();
    const { input } = mount(<InlineEdit value="x" label="Name" maxLength={3} onCommit={onCommit} />);
    type(input(), 'abcdef');
    key(input(), 'Enter');
    expect(onCommit).toHaveBeenCalledWith('abc');
  });
});
