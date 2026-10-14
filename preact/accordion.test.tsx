import { describe, it, expect, vi, afterEach } from 'vitest';
import 'preact/compat';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { Accordion } from './index';
import type { AccordionItem } from './index';

afterEach(() => { document.body.replaceChildren(); });

const ITEMS: AccordionItem[] = [
  { id: 'a', label: 'Layout', meta: '6', content: <p>layout entries</p> },
  { id: 'b', label: 'Navigation', meta: '5', content: <p>navigation entries</p> },
  { id: 'c', label: 'Feedback', content: <p>feedback entries</p> },
];

function mount(node: preact.ComponentChild) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return root;
}
const items = (r: Element) => [...r.querySelectorAll<HTMLDetailsElement>(':scope [data-boogy="accordion"] > details[data-slot="item"]')];
const triggers = (r: Element) => items(r).map((d) => d.querySelector<HTMLElement>(':scope > summary[data-slot="trigger"]')!);
/** Toggle an item as the browser does on a press of its summary. */
const toggle = (d: HTMLDetailsElement) => act(() => { d.open = !d.open; d.dispatchEvent(new Event('toggle')); });
const key = (el: Element, k: string) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  act(() => { el.dispatchEvent(e); });
  return e;
};

describe('<Accordion>', () => {
  it('is a named group of items, each a native details: its trigger the label, a trailing note, a chevron; its content below', () => {
    const r = mount(<Accordion label="Components" items={ITEMS} />);
    const group = r.querySelector('[data-boogy="accordion"]')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Components');
    const [a] = items(r);
    const trigger = triggers(r)[0];
    expect(trigger.querySelector('[data-slot="label"]')!.textContent).toBe('Layout');
    expect(trigger.querySelector('[data-slot="meta"]')!.textContent).toBe('6');
    expect(trigger.querySelector('[data-slot="chevron"]')!.getAttribute('aria-hidden')).toBe('true');
    expect(a.querySelector(':scope > [data-slot="content"]')!.textContent).toBe('layout entries');
    expect(triggers(r)[2].querySelector('[data-slot="meta"]')).toBeNull();
  });

  it('opens what defaultOpen names, and toggles on its own, reporting each change', () => {
    const onOpenChange = vi.fn();
    const r = mount(<Accordion label="Components" items={ITEMS} defaultOpen={['b']} onOpenChange={onOpenChange} />);
    expect(items(r).map((d) => d.open)).toEqual([false, true, false]);
    toggle(items(r)[0]);
    expect(onOpenChange).toHaveBeenLastCalledWith(['b', 'a']);
    expect(items(r).map((d) => d.open)).toEqual([true, true, false]);
  });

  it('single: opening one closes the others', () => {
    const r = mount(<Accordion label="Components" items={ITEMS} defaultOpen={['a']} single />);
    toggle(items(r)[2]);
    expect(items(r).map((d) => d.open)).toEqual([false, false, true]);
  });

  it('controlled: open is what the app says', () => {
    function App() {
      const [open, setOpen] = useState<string[]>(['c']);
      return <Accordion label="Components" items={ITEMS} open={open} onOpenChange={setOpen} />;
    }
    const r = mount(<App />);
    expect(items(r).map((d) => d.open)).toEqual([false, false, true]);
    toggle(items(r)[1]);
    expect(items(r).map((d) => d.open)).toEqual([false, true, true]);
  });

  it('Up, Down, Home and End move between the triggers of one level, not into a nested one', () => {
    const nested: AccordionItem[] = [
      { id: 'n1', label: 'Bars', content: <p>bars</p> },
      { id: 'n2', label: 'Tabs', content: <p>tabs</p> },
    ];
    const withNested: AccordionItem[] = [{ id: 'a', label: 'Layout', content: <Accordion label="Layout" items={nested} defaultOpen={['n1']} /> }, ...ITEMS.slice(1)];
    const r = mount(<Accordion label="Components" items={withNested} defaultOpen={['a']} />);
    const top = [...r.querySelectorAll<HTMLElement>(':scope > [data-boogy="accordion"] > details > summary')];
    top[0].focus();
    expect(key(top[0], 'ArrowDown').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(top[1]);
    key(top[1], 'End');
    expect(document.activeElement).toBe(top[2]);
    key(top[2], 'Home');
    expect(document.activeElement).toBe(top[0]);
    // Inside the nested level, its keys stay in it.
    const inner = [...r.querySelectorAll<HTMLElement>('[data-boogy="accordion"] [data-boogy="accordion"] > details > summary')];
    inner[0].focus();
    key(inner[0], 'ArrowDown');
    expect(document.activeElement).toBe(inner[1]);
    key(inner[1], 'ArrowDown');
    expect(document.activeElement).toBe(inner[1]);
  });
});

describe('<Accordion> nestedOpen: how an item opens its sub-accordion', () => {
  const SUB = (props: Partial<preact.ComponentProps<typeof Accordion>> = {}) => (
    <Accordion label="Background" className="sub" defaultOpen={['x', 'y']} {...props} items={[
      { id: 'x', label: 'Base', content: <p>base</p> },
      { id: 'y', label: 'Pattern', content: <p>pattern</p> },
      { id: 'z', label: 'Extra', content: <p>extra</p> },
    ]} />
  );
  const tree = (nestedOpen?: 'all' | 'first' | 'none', sub = SUB()) => (
    <Accordion label="Settings" className="top" nestedOpen={nestedOpen} items={[
      { id: 'name', label: 'Name', content: <p>name</p> },
      { id: 'bg', label: 'Background', content: sub },
    ]} />
  );
  const top = (r: Element) => [...r.querySelectorAll<HTMLDetailsElement>('.top > details')];
  const sub = (r: Element) => [...r.querySelectorAll<HTMLDetailsElement>('.sub > details')].map((d) => d.open);

  it('"none": opening the item shows its sub-items all collapsed, whatever their defaultOpen', () => {
    const r = mount(tree('none'));
    toggle(top(r)[1]);
    expect(sub(r)).toEqual([false, false, false]);
  });

  it('"first": only the first sub-item open', () => {
    const r = mount(tree('first'));
    toggle(top(r)[1]);
    expect(sub(r)).toEqual([true, false, false]);
  });

  it('"all": every sub-item open', () => {
    const r = mount(tree('all'));
    toggle(top(r)[1]);
    expect(sub(r)).toEqual([true, true, true]);
  });

  it('applies on every opening: a sub-item opened by hand is collapsed again when the item is reopened', () => {
    const r = mount(tree('none'));
    toggle(top(r)[1]);
    toggle(r.querySelectorAll<HTMLDetailsElement>('.sub > details')[2]);
    expect(sub(r)).toEqual([false, false, true]);
    toggle(top(r)[1]);
    toggle(top(r)[1]);
    expect(sub(r)).toEqual([false, false, false]);
  });

  it('unset: the sub-accordion keeps its own defaultOpen, as before', () => {
    const r = mount(tree(undefined));
    toggle(top(r)[1]);
    expect(sub(r)).toEqual([true, true, false]);
  });

  it('a controlled sub-accordion is the app\'s: nestedOpen leaves it alone', () => {
    const r = mount(tree('none', SUB({ open: ['y'] })));
    toggle(top(r)[1]);
    expect(sub(r)).toEqual([false, true, false]);
  });

  it('reaches only its own sub-accordion, not one nested deeper', () => {
    const deep = (
      <Accordion label="Mid" className="sub" items={[
        { id: 'x', label: 'Mid item', content: (
          <Accordion label="Deep" className="deep" defaultOpen={['d1']} items={[{ id: 'd1', label: 'Deep item', content: <p>deep</p> }]} />
        ) },
      ]} />
    );
    const r = mount(tree('all', deep));
    toggle(top(r)[1]);
    expect(sub(r)).toEqual([true]);
    expect([...r.querySelectorAll<HTMLDetailsElement>('.deep > details')].map((d) => d.open)).toEqual([true]);
  });
});

describe('<Accordion> item icons', () => {
  it('draws an item\'s icon before its label, at either level, hidden from assistive tech; none when not given', () => {
    const r = mount(
      <Accordion label="Settings" items={[
        { id: 'a', label: 'Name', icon: <svg data-test="pencil" />, content: (
          <Accordion label="Sub" items={[{ id: 's', label: 'Base', icon: <svg data-test="palette" />, content: <p /> }]} />
        ) },
        { id: 'b', label: 'Plain', content: <p /> },
      ]} />,
    );
    const [a, s, b] = triggers(r);
    const icon = a.querySelector(':scope > [data-slot="icon"]')!;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.querySelector('[data-test="pencil"]')).not.toBeNull();
    expect(icon.nextElementSibling!.getAttribute('data-slot')).toBe('label');
    expect(s.querySelector(':scope > [data-slot="icon"] [data-test="palette"]')).not.toBeNull();
    expect(b.querySelector('[data-slot="icon"]')).toBeNull();
  });
});
