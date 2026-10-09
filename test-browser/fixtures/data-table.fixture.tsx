// The DataTable for the browser test: bundled with Preact and the SDK, it
// mounts one table, as an app renders it, in a box of a given width. Every
// cell's content is a fixed width, so a column needs that width plus its
// cells' padding, and a table kept wider than its box scrolls sideways.
import { render } from 'preact';
import { installFoundation } from '../../src/index';
import { DataTable, type DataColumn } from '../../preact/index';

type Row = { id: string; title: string; a: number; b: number };
const ROWS: Row[] = Array.from({ length: 4 }, (_, i) => ({ id: `r${i}`, title: `Row ${i}`, a: i, b: i * 10 }));
const fixed = (text: string | number) => <span style="display:inline-block;inline-size:6rem">{text}</span>;
const COLUMNS: DataColumn<Row>[] = [
  { key: 'title', header: 'Title', priority: 1, minWidth: '6rem', cell: (r) => <button type="button">{r.title}</button> },
  { key: 'a', header: 'A', priority: 2, minWidth: '6rem', numeric: true, sortable: true, cell: (r) => fixed(r.a) },
  { key: 'b', header: 'B', priority: 3, minWidth: '6rem', numeric: true, sortable: true, cell: (r) => fixed(r.b) },
];

type Sort = { key: string; direction: 'ascending' | 'descending' };

(window as unknown as Record<string, unknown>).dataTableFixture = {
  /** `css` is the app's own stylesheet, added after the SDK's. */
  mount(width: number, sort?: Sort, css = '') {
    installFoundation();
    document.body.innerHTML = `<style>${css}</style><div id="host" style="width:${width}px;background:white"></div>`;
    render(
      <DataTable caption="Rows" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} titleKey="title" sort={sort} onSort={() => {}} />,
      document.getElementById('host')!,
    );
  },
  report() {
    const box = document.querySelector<HTMLElement>('[data-boogy="data-table"]')!;
    return {
      shown: [...box.querySelectorAll<HTMLElement>('thead th')].filter((th) => !th.hidden).map((th) => th.textContent),
      sideways: box.scrollWidth > box.clientWidth + 1,
    };
  },
};
