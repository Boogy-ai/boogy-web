// The TabPager for the browser test: bundled with Preact and the SDK, a row of
// tabs over a pager of four pages, the current index held by the component
// that renders them (their owner). With `frame`, every page holds a framed
// page at that URL.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { installFoundation, tabId, tabPage } from '../../src/index';
import { TabList, TabPager } from '../../preact/index';

const ITEMS = ['One', 'Two', 'Three', 'Four'].map((label, i) => ({ id: `p${i}`, label }));
/** What the owner was told: every page the pager reported, and its index now. */
const owner = { reported: [] as number[], index: 0 };

function Pages({ frame }: { frame?: string }) {
  const [at, setAt] = useState(0);
  owner.index = at;
  return (
    <div style="display:flex;flex-direction:column;width:400px">
      <TabList label="Pages" items={ITEMS} selected={ITEMS[at].id} onSelect={(id) => setAt(ITEMS.findIndex((t) => t.id === id))} panel="pages" />
      <TabPager id="pages" index={at} onIndexChange={(i) => { owner.reported.push(i); setAt(i); }} style="height:300px">
        {ITEMS.map((t, i) => (
          <div key={t.id} {...tabPage(i, { current: i === at })} aria-labelledby={tabId('pages', t.id)}>
            {frame ? <iframe src={frame} title={t.label} style="display:block;border:0;width:100%;height:100%" /> : t.label}
          </div>
        ))}
      </TabPager>
    </div>
  );
}

const host = () => document.getElementById('host') ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'host' }));
const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };

(window as unknown as Record<string, unknown>).tabPagerFixture = {
  mount(frame?: string) {
    installFoundation();
    owner.reported = [];
    render(null, host());
    render(<Pages frame={frame} />, host());
  },
  /** A press on tab `i` (a click, as a tap ends). */
  select(i: number) { document.querySelectorAll<HTMLElement>('[role="tab"]')[i].click(); },
  report() {
    const pager = document.getElementById('pages')!;
    const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')];
    return {
      pager: rect(pager),
      page: pager.scrollLeft / pager.clientWidth,
      reported: [...owner.reported],
      index: owner.index,
      selected: tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'),
      line: rect(document.querySelector('[data-boogy="tab-list"] > [data-slot="indicator"]')!),
      tabs: tabs.map(rect),
    };
  },
};
