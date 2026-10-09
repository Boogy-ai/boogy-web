import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { ColumnChart, DataTable, Stat } from './index';
import { flushRounds, setFrameScheduler } from '../src/components/measure';

let restore: (run: () => void) => void;
beforeEach(() => { restore = setFrameScheduler(() => {}); });
afterEach(() => { setFrameScheduler(restore); document.body.replaceChildren(); });
function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return root;
}

type Row = { id: string; q: string; n: number };
const rows: Row[] = [{ id: 'a', q: 'Lunch?', n: 3 }, { id: 'b', q: 'Dinner?', n: 12 }];

describe('<DataTable>', () => {
  it('renders a semantic table: column headers, a row header holding the title control, numeric cells marked', () => {
    const onOpen = vi.fn();
    const root = mount(<DataTable<Row> caption="Polls" rows={rows} rowKey={(r) => r.id} titleKey="q" columns={[
      { key: 'q', header: 'Question', priority: 1, minWidth: '10rem', cell: (r) => <button onClick={() => onOpen(r.id)}>{r.q}</button> },
      { key: 'n', header: 'Signed in', priority: 1, minWidth: '4rem', numeric: true, cell: (r) => r.n },
      { key: 'c', header: 'Created', priority: 2, minWidth: '5rem', sortable: true, cell: () => 'x' },
    ]} sort={{ key: 'c', direction: 'descending' }} onSort={() => {}} />);
    const table = root.querySelector('[data-boogy="data-table"] table')!;
    expect(table.querySelector('caption')!.textContent).toBe('Polls');
    expect([...table.querySelectorAll('thead th')].map((th) => th.getAttribute('scope'))).toEqual(['col', 'col', 'col']);
    expect(table.querySelector('thead th:nth-child(3)')!.getAttribute('aria-sort')).toBe('descending');
    const first = table.querySelector('tbody tr')!;
    expect(first.querySelector('th[scope="row"][data-slot="title"] > button')!.textContent).toBe('Lunch?');
    expect(first.querySelector('td[data-numeric="true"]')!.textContent).toBe('3');
    act(() => (first.querySelector('button') as HTMLButtonElement).click());
    expect(onOpen).toHaveBeenCalledWith('a');
  });

  it('reports a press on the sortable header', () => {
    const onSort = vi.fn();
    const root = mount(<DataTable<Row> caption="Polls" rows={rows} rowKey={(r) => r.id} titleKey="q" columns={[
      { key: 'q', header: 'Question', priority: 1, minWidth: '10rem', cell: (r) => r.q },
      { key: 'c', header: 'Created', priority: 2, minWidth: '5rem', sortable: true, cell: () => 'x' },
    ]} sort={{ key: 'c', direction: 'ascending' }} onSort={onSort} />);
    act(() => (root.querySelector('thead th:nth-child(2) button') as HTMLButtonElement).click());
    expect(onSort).toHaveBeenCalledWith('c');
  });

  it('hides the lower-priority columns when its box is too narrow', () => {
    // happy-dom lays nothing out: give the box 100 px, and make a length probe
    // report its rem width (16 px a rem), so 10rem + 5rem = 240 px cannot fit.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const v = this.style.width;
      const w = v.endsWith('rem') ? Number.parseFloat(v) * 16 : 0;
      return { width: w, height: 0, x: 0, y: 0, top: 0, left: 0, right: w, bottom: 0, toJSON() {} } as DOMRect;
    });
    const root = mount(<DataTable<Row> caption="Polls" rows={rows} rowKey={(r) => r.id} titleKey="q" columns={[
      { key: 'q', header: 'Question', priority: 1, minWidth: '10rem', cell: (r) => r.q },
      { key: 'c', header: 'Created', priority: 2, minWidth: '5rem', cell: () => 'x' },
    ]} />);
    act(() => flushRounds());
    const created = root.querySelectorAll('thead th')[1] as HTMLElement;
    expect(created.hidden).toBe(true);
    expect((root.querySelectorAll('tbody tr td')[0] as HTMLElement).hidden).toBe(true);
    vi.restoreAllMocks();
  });

  it("counts each cell's inline padding toward its column's minimum", () => {
    // 10rem + 5rem = 240 px fits a 250 px box; with 8 px of padding either
    // side of each cell, 272 px does not, and the lower priority goes.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(250);
    const table = () => mount(<DataTable<Row> caption="Polls" rows={rows} rowKey={(r) => r.id} titleKey="q" columns={[
      { key: 'q', header: 'Question', priority: 1, minWidth: '10rem', cell: (r) => r.q },
      { key: 'c', header: 'Created', priority: 2, minWidth: '5rem', cell: () => 'x' },
    ]} />);
    const created = (root: HTMLElement) => root.querySelectorAll('thead th')[1] as HTMLElement;
    const bare = table();
    act(() => flushRounds());
    expect(created(bare).hidden).toBe(false);
    const style = document.createElement('style');
    style.textContent = '[data-boogy="data-table"] th, [data-boogy="data-table"] td { padding: 0 8px; }';
    document.head.append(style);
    try {
      const padded = table();
      act(() => flushRounds());
      expect(created(padded).hidden).toBe(true);
    } finally {
      style.remove();
      vi.restoreAllMocks();
    }
  });
});

describe('<Stat>', () => {
  it('shows the value, fitted, over its label and caption', () => {
    const root = mount(<Stat label="Polls" value="12" caption="3 open" min="1.5rem" max="5rem" />);
    const el = root.querySelector('[data-boogy="stat"]')!;
    expect(el.querySelector('[data-slot="value"][data-boogy="fit-text"]')!.textContent).toBe('12');
    expect(el.querySelector('[data-slot="label"]')!.textContent).toBe('Polls');
    expect(el.querySelector('[data-slot="caption"]')!.textContent).toBe('3 open');
  });
  it('stats given one group are fitted at one size, and the group is not an attribute', () => {
    const root = mount(<><Stat label="A" value="12" min="1rem" max="4rem" group="row" /><Stat label="B" value="12,345" min="1rem" max="4rem" group="row" /></>);
    const [a, b] = [...root.querySelectorAll('[data-slot="value"]')] as HTMLElement[];
    // happy-dom lays nothing out: each value "fits" up to its own factor.
    const layout = (el: HTMLElement, upTo: number) => {
      const f = () => Number.parseFloat(el.style.getPropertyValue('--fit') || '1');
      Object.defineProperty(el, 'clientWidth', { get: () => 40 });
      Object.defineProperty(el, 'scrollWidth', { get: () => (f() <= upTo ? 40 : 120) });
    };
    layout(a, 0.8);
    layout(b, 0.3);
    flushRounds();
    expect(a.style.getPropertyValue('--fit')).toBe(b.style.getPropertyValue('--fit'));
    expect(Number.parseFloat(a.style.getPropertyValue('--fit'))).toBeLessThanOrEqual(0.3);
    expect(root.querySelector('[group]')).toBeNull();
  });
});

describe('<ColumnChart>', () => {
  it('draws the columns hidden from assistive technology, and carries a visually hidden table of every value', () => {
    const root = mount(<ColumnChart caption="Votes over time" labelHeader="When" startLabel="10:00" endLabel="10:10" columns={[
      { label: '10:00', segments: [{ value: 2, color: 'var(--c)', label: 'signed in' }, { value: 1, color: 'var(--c)', label: 'by invite', pattern: 'stripes' }] },
      { label: '10:05', segments: [{ value: 0, color: 'var(--c)', label: 'signed in' }, { value: 3, color: 'var(--c)', label: 'by invite', pattern: 'stripes' }] },
    ]} />);
    const fig = root.querySelector('figure[data-boogy="column-chart"]')!;
    expect(fig.querySelector('[data-slot="columns"]')!.getAttribute('aria-hidden')).toBe('true');
    // Hidden by a box around it: a table's caption is laid out outside the
    // table's own box in some engines, where a clip on the table misses it.
    const table = fig.querySelector('[data-visually-hidden] > table')!;
    expect(table.hasAttribute('data-visually-hidden')).toBe(false);
    expect(table.querySelector('caption')!.textContent).toBe('Votes over time');
    expect([...table.querySelectorAll('tbody tr')].map((tr) => tr.textContent)).toEqual(['10:0021', '10:0503']);
    expect(fig.querySelector('[data-slot="axis"]')!.textContent).toBe('10:0010:10');
  });
  it('heads its hidden table with every kind any column holds, and fills a missing value with 0', () => {
    const root = mount(<ColumnChart caption="Values" labelHeader="Minute" startLabel="a" endLabel="b" columns={[
      { label: 'a', segments: [{ value: 2, color: 'var(--c)', label: 'first' }] },
      { label: 'b', segments: [{ value: 5, color: 'var(--c)', label: 'second' }, { value: 1, color: 'var(--c)', label: 'first' }] },
    ]} />);
    const table = root.querySelector('[data-visually-hidden] > table')!;
    // The column of labels is headed in the app's own words.
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Minute', 'first', 'second']);
    expect([...table.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent))).toEqual([['a', '2', '0'], ['b', '1', '5']]);
  });
});
