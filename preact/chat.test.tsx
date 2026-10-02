import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { Bubble, Composer, Sheet, Thread } from './index';

afterEach(() => { document.body.replaceChildren(); });
const mount = (el: preact.ComponentChild) => { const r = document.createElement('div'); document.body.append(r); act(() => render(el, r)); return r; };

describe('<Thread> and <Bubble>', () => {
  it('a labelled log of bubbles, each its text and time on its side', () => {
    const r = mount(
      <Thread label="Messages with carol">
        <Bubble side="start" meta="14:01">hi</Bubble>
        <Bubble side="end" meta="14:02">{'hello\nthere'}</Bubble>
      </Thread>,
    );
    const t = r.querySelector('[data-boogy="thread"]')!;
    expect(t.getAttribute('role')).toBe('log');
    expect(t.getAttribute('aria-label')).toBe('Messages with carol');
    const b = [...t.querySelectorAll('[data-boogy="bubble"]')];
    expect(b.map((x) => x.getAttribute('data-side'))).toEqual(['start', 'end']);
    expect(b[1].querySelector('[data-slot="body"]')!.textContent).toBe('hello\nthere');
    expect(b[1].querySelector('[data-slot="meta"]')!.textContent).toBe('14:02');
  });
  it('no meta, no meta line', () => {
    expect(mount(<Bubble>hi</Bubble>).querySelector('[data-slot="meta"]')).toBeNull();
  });
});

describe('<Composer>', () => {
  function composer(over: Partial<Parameters<typeof Composer>[0]> = {}) {
    const props = { label: 'Message carol', value: '', onValueChange: vi.fn(), onSubmit: vi.fn(), ...over };
    const r = mount(<Composer {...props} />);
    return { r, props, area: r.querySelector('textarea')!, send: r.querySelector<HTMLButtonElement>('button')! };
  }
  const key = (el: Element, k: string, extra: KeyboardEventInit = {}) =>
    act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra })); });

  it('a labelled multi-line input in a field group, with a send button at its end', () => {
    const { r, area, send } = composer();
    expect(r.querySelector('[data-boogy="field"] > [data-slot="group"] > textarea[data-slot="control"]')).toBe(area);
    expect(area.getAttribute('aria-label')).toBe('Message carol');
    expect(r.querySelector('[data-slot="group"] > [data-slot="suffix"] button')).toBe(send);
    expect(send.getAttribute('aria-label')).toBe('Send');
  });
  it('reports each change', () => {
    const { area, props } = composer();
    act(() => { area.value = 'hi'; area.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(props.onValueChange).toHaveBeenCalledWith('hi');
  });
  it('send waits for something other than blanks', () => {
    expect(composer({ value: '  \n ' }).send.disabled).toBe(true);
    document.body.replaceChildren();
    expect(composer({ value: 'hi' }).send.disabled).toBe(false);
  });
  it('Enter sends; Shift+Enter is a new line; Enter while composing text (an IME) is not a send', () => {
    const { area, props } = composer({ value: 'hi' });
    key(area, 'Enter', { shiftKey: true });
    key(area, 'Enter', { isComposing: true });
    expect(props.onSubmit).not.toHaveBeenCalled();
    key(area, 'Enter');
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });
  it('Enter on blanks sends nothing; the button sends too', async () => {
    const blank = composer({ value: ' ' });
    key(blank.area, 'Enter');
    expect(blank.props.onSubmit).not.toHaveBeenCalled();
    document.body.replaceChildren();
    const { send, props } = composer({ value: 'hi' });
    await act(async () => { send.click(); });
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('<Sheet start>', () => {
  it('a control before the title, in the head', () => {
    const r = mount(<Sheet title="carol" start={<button>Back</button>}><p /></Sheet>);
    const head = r.querySelector('[data-boogy="sheet"] > [data-slot="head"]')!;
    expect([...head.children].map((c) => c.tagName.toLowerCase())).toEqual(['button', 'h1']);
  });
});
