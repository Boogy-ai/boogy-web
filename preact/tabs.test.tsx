import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { TabList, TabPanel, Tabs } from './index';

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
  it("a tab may lead with a glyph: hidden from assistive tech, the label still its name; a tab without one has no slot", () => {
    const items = [{ id: 'a', label: 'Buddies', icon: <svg data-test="people" /> }, { id: 'b', label: 'Plain' }];
    const r = mount(<Tabs label="Pick" items={items} selected="a" onSelect={() => {}}><p>x</p></Tabs>);
    const [a, b] = tabsOf(r);
    const icon = a.querySelector(':scope > [data-slot="icon"]')!;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.querySelector('svg[data-test="people"]')).toBeTruthy();
    expect(a.firstElementChild).toBe(icon);
    expect(a.textContent).toBe('Buddies');
    expect(b.querySelector('[data-slot="icon"]')).toBeNull();
  });

  it('fill: the row carries the option, so its tabs share it evenly', () => {
    const r = mount(<Tabs label="Pick" items={ITEMS} selected="one" onSelect={() => {}} fill><p>x</p></Tabs>);
    expect(r.querySelector('[data-boogy="tab-list"]')!.getAttribute('data-fill')).toBe('true');
  });

  it('the row and the panel can be shown apart (a row in a top bar), linked by the panel\'s id', () => {
    function Apart() {
      const [at, setAt] = useState('two');
      return (
        <>
          <TabList label="Pick" items={ITEMS} selected={at} onSelect={setAt} panel="pick" />
          <TabPanel id="pick" selected={at}><p>panel for {at}</p></TabPanel>
        </>
      );
    }
    const r = mount(<Apart />);
    const list = r.querySelector('[data-boogy="tab-list"]')!;
    expect(list.getAttribute('role')).toBe('tablist');
    expect(list.getAttribute('aria-label')).toBe('Pick');
    const panel = r.querySelector('[role="tabpanel"]')!;
    expect(panel.getAttribute('data-boogy')).toBe('tab-panel');
    const [, two, three] = tabsOf(r);
    expect(two.id).toBe('pick--two');
    expect(two.getAttribute('aria-controls')).toBe('pick');
    expect(panel.getAttribute('aria-labelledby')).toBe('pick--two');
    two.focus();
    key(two, 'ArrowRight');
    expect(document.activeElement).toBe(three);
    expect(r.querySelector('[role="tabpanel"]')!.getAttribute('aria-labelledby')).toBe('pick--three');
    expect(r.textContent).toContain('panel for three');
  });

});
