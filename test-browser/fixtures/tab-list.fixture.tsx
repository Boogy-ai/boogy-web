// The TabList for the browser test: bundled with Preact and the SDK, it mounts
// a row of eight tabs in a box of a given width and reports how the row scrolls.
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { installFoundation } from '../../src/index';
import { TabList } from '../../preact/index';

// Labels of different lengths: a filled row that fits still shares itself evenly.
const ITEMS = ['Buddies', 'Settings', 'A', 'Section four', 'Five', 'The sixth section', 'Seven', 'Eight'].map((label, i) => ({ id: `t${i}`, label }));
const host = () => document.getElementById('host')!;
const list = () => host().querySelector<HTMLElement>('[data-boogy="tab-list"]')!;

// `fresh`: as most apps write it, the tabs are a new array on every render, and
// the parent renders again on every scroll (to show where the row is).
function Row({ fill, fresh }: { fill: boolean; fresh: boolean }) {
  const [at, setAt] = useState('t0');
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!fresh) return;
    const tick = () => setTick((n) => n + 1);
    document.addEventListener('scroll', tick, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', tick, { capture: true });
  }, [fresh]);
  const items = fresh ? ITEMS.map((t) => ({ ...t })) : ITEMS;
  return <TabList label="Sections" items={items} selected={at} onSelect={setAt} fill={fill} panel="sections" />;
}

(window as unknown as Record<string, unknown>).tabListFixture = {
  mount(width: number, fill: boolean, fresh = false) {
    installFoundation();
    document.body.innerHTML = `<div id="host" style="width:${width}px"></div>`;
    render(<Row fill={fill} fresh={fresh} />, host());
  },
  resize(width: number) { host().style.width = `${width}px`; },
  scrollTo(left: number) { list().scrollLeft = left; list().dispatchEvent(new Event('scroll')); },
  select(index: number) { list().querySelectorAll<HTMLElement>('[role="tab"]')[index].click(); },
  report() {
    const el = list();
    const box = el.getBoundingClientRect();
    const tabs = [...el.querySelectorAll<HTMLElement>('[role="tab"]')];
    const selected = tabs.find((t) => t.getAttribute('aria-selected') === 'true')!.getBoundingClientRect();
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollLeft: el.scrollLeft,
      // A visible horizontal scrollbar takes height from the box.
      scrollbar: el.offsetHeight - el.clientHeight,
      left: el.hasAttribute('data-more-left'),
      right: el.hasAttribute('data-more-right'),
      clipped: tabs.filter((t) => t.scrollWidth > t.clientWidth + 1).length,
      widths: tabs.map((t) => Math.round(t.getBoundingClientRect().width)),
      // The selected tab's centre, from the row's centre.
      selectedOffCentre: Math.round(selected.left + selected.width / 2 - (box.left + box.width / 2)),
      selectedInView: selected.left >= box.left - 1 && selected.right <= box.right + 1,
    };
  },
};
