// The TopBar for the browser test: bundled with Preact and the SDK, it mounts
// one bar in a box of a given width and reports what the bar shows. Its size
// control is the one the bar builds in.
import { render } from 'preact';
import { installFoundation, zoomState } from '../../src/index';
import { setHostZoom } from '../../src/layout/zoom';
import { TopBar, type TopBarItem } from '../../preact/index';

const noop = () => {};
const ITEMS: TopBarItem[] = [
  { id: 'edit', label: 'Edit', priority: 1, onAction: noop },
  { id: 'links', label: 'Invite links', priority: 1, onAction: noop },
  { id: 'present', label: 'Present', priority: 2, onAction: noop },
  { id: 'close', label: 'Close', priority: 3, variant: 'danger', onAction: noop },
  { id: 'delete', label: 'Delete', priority: 4, variant: 'danger', onAction: noop },
];

const host = () => document.getElementById('host')!;

(window as unknown as Record<string, unknown>).topBarFixture = {
  mount(width: number) {
    installFoundation();
    document.body.innerHTML = `<div id="host" style="width:${width}px"></div>`;
    render(<TopBar title="A title long enough to need its room" items={ITEMS} />, host());
  },
  resize(width: number) { host().style.width = `${width}px`; },
  hostZoom(factor: number) { setHostZoom(factor); },
  zoom: () => zoomState().zoom,
  report() {
    const bar = host().querySelector<HTMLElement>('[data-boogy="top-bar"]')!;
    const title = bar.querySelector<HTMLElement>('[data-slot="title"]')!.getBoundingClientRect();
    const actions = bar.querySelector<HTMLElement>('[data-slot="actions"]')!.getBoundingClientRect();
    return {
      shown: [...bar.querySelectorAll<HTMLElement>('[data-slot="actions"] > [data-item]')].map((el) => el.dataset.item),
      more: !!bar.querySelector('[data-slot="more"]'),
      // Nothing overlaps and nothing spills: the title ends before the actions, which end inside the bar.
      clear: title.right <= actions.left + 0.5 && actions.right <= bar.getBoundingClientRect().right + 0.5,
      spills: bar.scrollWidth > bar.clientWidth + 1,
      fontPx: Number.parseFloat(getComputedStyle(bar.querySelector('[data-slot="actions"] button')!).fontSize),
      // How an item is laid out in the bar, and in the row that measures it.
      itemStyle: [bar.querySelector('[data-slot="actions"] > [data-item]'), bar.querySelector('[data-slot="measure"] > div > [data-item]')]
        .map((el) => { const cs = getComputedStyle(el!); return `${cs.display} ${cs.flexShrink} ${cs.alignItems}`; }),
    };
  },
};
