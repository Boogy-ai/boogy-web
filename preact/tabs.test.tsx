import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { TabList, TabPager, TabPanel, Tabs } from './index';
import { tabPage } from '@boogy/web';

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

describe('<TabList> counts', () => {
  it('a tab may carry a count: a badge after its label, part of its name', () => {
    const root = mount(<TabList label="Members and invites" panel="p" selected="a" onSelect={() => {}}
      items={[{ id: 'a', label: 'Members', count: 10003 }, { id: 'b', label: 'Invites', count: 6 }, { id: 'c', label: 'Removed' }]} />);
    const [a, b, c] = tabsOf(root);
    expect(a.querySelector(':scope > [data-boogy="count"]')?.getAttribute('title')).toBe(new Intl.NumberFormat().format(10003));
    expect(b.textContent).toBe('Invites6');
    expect(c.querySelector('[data-boogy="count"]')).toBeNull();
  });
});

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

describe('<TabList> edge', () => {
  it('edge="top" reaches the row, so its lines run along its top', () => {
    const r = mount(<TabList label="Pick" items={ITEMS} selected="one" onSelect={() => {}} edge="top" panel="pick" />);
    expect(r.querySelector('[data-boogy="tab-list"]')!.getAttribute('data-edge')).toBe('top');
  });
});

// happy-dom lays nothing out: each tab's place and width, the row's and the
// pager's are set here as a layout engine would report them.
const place = (el: Element, left: number, width: number) => {
  Object.defineProperty(el, 'offsetLeft', { configurable: true, get: () => left });
  Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => width });
};
const size = (el: Element, client: number, scroll: number) => {
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => client });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => scroll });
};

describe('<TabList> over a pager', () => {
  type Item = { id: string; label: string; action?: preact.ComponentChildren };
  function Paged({ items = ITEMS as Item[] }: { items?: Item[] }) {
    return (
      <>
        <TabList label="Pick" items={items} selected="one" onSelect={() => {}} panel="pages" />
        <TabPager id="pages" index={0} onIndexChange={() => {}}>
          {items.map((t, i) => <div key={t.id} {...tabPage(i, { current: i === 0 })}>{t.label}</div>)}
        </TabPager>
      </>
    );
  }
  const indicator = (r: HTMLElement) => r.querySelector<HTMLElement>('[data-boogy="tab-list"] > [data-slot="indicator"]')!;
  /** The pager scrolled to `left`, 300px a page. */
  const scrollPager = (left: number) => {
    const pager = document.getElementById('pages')!;
    size(pager, 300, 900);
    pager.scrollLeft = left;
    act(() => { pager.dispatchEvent(new Event('scroll')); });
  };

  it('is marked paged, and draws one line at the blended place and width of the two tabs the pager lies between', () => {
    const r = mount(<Paged />);
    expect(r.querySelector('[data-boogy="tab-list"]')!.hasAttribute('data-paged')).toBe(true);
    const [one, two, three] = tabsOf(r);
    place(one, 0, 60);
    place(two, 60, 100);
    place(three, 160, 80);
    scrollPager(150); // halfway from the first page to the second
    expect(indicator(r).style.transform).toBe('translateX(30px)');
    expect(indicator(r).style.width).toBe('80px');
    scrollPager(450); // halfway from the second to the third
    expect(indicator(r).style.transform).toBe('translateX(110px)');
    expect(indicator(r).style.width).toBe('90px');
    // Written to the element: the selection is untouched.
    expect(tabsOf(r)[0].getAttribute('aria-selected')).toBe('true');
  });

  it('scrolls the row to keep that line in its middle', () => {
    const r = mount(<Paged />);
    const row = r.querySelector<HTMLElement>('[data-boogy="tab-list"]')!;
    size(row, 200, 400);
    const [one, two, three] = tabsOf(r);
    place(one, 0, 60);
    place(two, 60, 100);
    place(three, 160, 80);
    scrollPager(450); // the line from 110 to 200: its middle, 155, to the row's
    expect(row.scrollLeft).toBe(55);
  });

  it("a tab's action is one piece with its tab: the line spans them both", () => {
    const items = [{ id: 'one', label: 'One' }, { id: 'two', label: 'Two', action: <button id="act">⋮</button> }, { id: 'three', label: 'Three' }];
    const r = mount(<Paged items={items} />);
    const [one, two, three] = tabsOf(r);
    place(one, 0, 60);
    place(two, 60, 100);
    place(r.querySelector('[data-slot="tab-action"]')!, 160, 30);
    place(three, 190, 80);
    scrollPager(300);
    expect(indicator(r).style.transform).toBe('translateX(60px)');
    expect(indicator(r).style.width).toBe('130px');
  });

  it('a row whose panel is not a pager is not paged', () => {
    const r = mount(
      <>
        <TabList label="Pick" items={ITEMS} selected="one" onSelect={() => {}} panel="plain" />
        <TabPanel id="plain" selected="one"><p>x</p></TabPanel>
      </>,
    );
    expect(r.querySelector('[data-boogy="tab-list"]')!.hasAttribute('data-paged')).toBe(false);
    const none = mount(<TabList label="Pick" items={ITEMS} selected="one" onSelect={() => {}} panel="nowhere" />);
    expect(none.querySelector('[data-boogy="tab-list"]')!.hasAttribute('data-paged')).toBe(false);
  });
});

describe("<TabList> a tab's action", () => {
  const items = [
    { id: 'one', label: 'One', action: <button id="a1" tabIndex={-1}>⋮</button> },
    { id: 'two', label: 'Two', action: <button id="a2" tabIndex={-1}>⋮</button> },
    { id: 'three', label: 'Three' },
  ];

  it('comes right after its tab, marked selected with it', () => {
    const r = mount(<TabList label="Pick" items={items} selected="one" onSelect={() => {}} panel="pick" />);
    const [one, two, three] = tabsOf(r);
    const a1 = one.nextElementSibling as HTMLElement;
    const a2 = two.nextElementSibling as HTMLElement;
    expect(a1.dataset.slot).toBe('tab-action');
    expect(a1.querySelector('#a1')).not.toBeNull();
    expect(a1.hasAttribute('data-selected')).toBe(true);
    expect(a2.querySelector('#a2')).not.toBeNull();
    expect(a2.hasAttribute('data-selected')).toBe(false);
    expect(three.nextElementSibling?.getAttribute('data-slot')).not.toBe('tab-action');
  });

  it('keeps its keys: Left and Right pressed on it do not change the tab, as they do on a tab', () => {
    const onSelect = vi.fn();
    const r = mount(<TabList label="Pick" items={items} selected="one" onSelect={onSelect} panel="pick" />);
    key(r.querySelector('#a1')!, 'ArrowRight');
    key(r.querySelector('#a1')!, 'ArrowLeft');
    expect(onSelect).not.toHaveBeenCalled();
    key(tabsOf(r)[0], 'ArrowRight');
    expect(onSelect).toHaveBeenCalledWith('two');
  });

  it('is pressed without choosing its tab', () => {
    const onSelect = vi.fn();
    const r = mount(<TabList label="Pick" items={items} selected="one" onSelect={onSelect} panel="pick" />);
    act(() => r.querySelector<HTMLElement>('#a2')!.click());
    expect(onSelect).not.toHaveBeenCalled();
  });
});
