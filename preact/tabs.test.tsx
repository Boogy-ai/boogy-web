import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { Tabs } from './index';

afterEach(() => { document.body.replaceChildren(); });

const ITEMS = [{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }, { id: 'three', label: 'Three' }];
function Harness({ onSelect }: { onSelect?: (id: string) => void }) {
  const [at, setAt] = useState('one');
  return (
    <Tabs label="Pick" items={ITEMS} selected={at} onSelect={(id) => { setAt(id); onSelect?.(id); }}>
      <p>panel for {at}</p>
    </Tabs>
  );
}
function mount(node: preact.ComponentChild) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return root;
}
const tabsOf = (r: HTMLElement) => [...r.querySelectorAll<HTMLElement>('[role="tab"]')];
const key = (el: Element, k: string) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });

describe('<Tabs>', () => {
  it('a named tablist; the selected tab is the one tab stop; the panel is labelled by it', () => {
    const r = mount(<Harness />);
    const list = r.querySelector('[role="tablist"]')!;
    expect(list.getAttribute('aria-label')).toBe('Pick');
    const [a, b] = tabsOf(r);
    expect(a.getAttribute('aria-selected')).toBe('true');
    expect(a.tabIndex).toBe(0);
    expect(b.tabIndex).toBe(-1);
    const panel = r.querySelector('[role="tabpanel"]')!;
    expect(panel.getAttribute('aria-labelledby')).toBe(a.id);
    expect(a.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.textContent).toBe('panel for one');
  });
  it('clicking a tab selects it', () => {
    const onSelect = vi.fn();
    const r = mount(<Harness onSelect={onSelect} />);
    act(() => tabsOf(r)[1].click());
    expect(onSelect).toHaveBeenCalledWith('two');
    expect(tabsOf(r)[1].getAttribute('aria-selected')).toBe('true');
    expect(r.querySelector('[role="tabpanel"]')!.textContent).toBe('panel for two');
  });
  it('arrow keys select the next tab and move focus to it, wrapping round', () => {
    const r = mount(<Harness />);
    act(() => tabsOf(r)[0].focus());
    key(tabsOf(r)[0], 'ArrowLeft');
    expect(tabsOf(r)[2].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabsOf(r)[2]);
    key(tabsOf(r)[2], 'Home');
    expect(document.activeElement).toBe(tabsOf(r)[0]);
  });
});
