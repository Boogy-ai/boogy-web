// The TopBar for the browser test: bundled with Preact and the SDK, it mounts
// one bar in a box of a given width and reports what the bar shows. Its size
// control is the one the bar builds in.
//
// `mountMenu` mounts a second bar whose More holds one row of each kind (two
// actions, a widget and a submenu whose content is the SDK's ColorPicker),
// every row led by a glyph, and `menuReport` measures how More and an open
// submenu are laid out.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { installFoundation, oklchToHex, zoomState, type PopoverVariant } from '../../src/index';
import { setHostZoom } from '../../src/layout/zoom';
import { ColorPicker, TopBar, ZoomControls, type TopBarItem } from '../../preact/index';

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

// --- More with one row of each kind ---

/** A glyph in the SDK's frame (24-unit box, 2-unit round stroke), as an app draws its own. */
const glyph = (paths: string[]) => (
  <svg data-boogy="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {paths.map((d) => <path key={d} d={d} />)}
  </svg>
);
const ROWS_GLYPH = glyph(['M4 5h16v14H4z', 'M4 12h16']);
const TYPE_GLYPH = glyph(['M4 7V5h16v2', 'M12 5v14', 'M9 19h6']);
const DROP_GLYPH = glyph(['M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z']);
const LINK_GLYPH = glyph(['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7']);

/** A 50-chip palette: a neutral row, then four tones across ten hues. */
const HUES = [25, 55, 90, 130, 160, 195, 235, 265, 300, 340];
const PALETTE = [
  ...Array.from({ length: 10 }, (_, i) => oklchToHex({ l: i / 9, c: 0, h: 0 })),
  ...[[0.38, 0.09], [0.52, 0.15], [0.7, 0.15], [0.88, 0.07]].flatMap(([l, c]) => HUES.map((h) => oklchToHex({ l, c, h }))),
].map((color) => ({ id: color, label: color, color }));

function Picker() {
  const [value, setValue] = useState(PALETTE[25].id);
  const [opacity, setOpacity] = useState(67);
  return <ColorPicker label="Colour" swatches={PALETTE} value={value} onValueChange={setValue} opacity={opacity} onOpacityChange={setOpacity} />;
}

const MENU_ITEMS: TopBarItem[] = [
  { id: 'split', label: 'Split into rows', priority: 1, place: 'menu', icon: ROWS_GLYPH, onAction: noop },
  { id: 'size', label: 'Size', priority: 2, place: 'menu', icon: TYPE_GLYPH, widget: <ZoomControls size="sm" label="Size" /> },
  { id: 'colour', label: 'Colour', priority: 3, place: 'menu', icon: DROP_GLYPH, submenu: <Picker /> },
  { id: 'link', label: 'Copy link', priority: 4, place: 'menu', icon: LINK_GLYPH, onAction: noop },
];

const rect = (el: Element | null) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
};

(window as unknown as Record<string, unknown>).topBarMenuFixture = {
  mountMenu(o: { width: number; variant: PopoverVariant }) {
    installFoundation();
    document.body.style.cssText = 'margin:0;background:var(--ground-sunken);color:var(--text-1);font-family:var(--font-body)';
    document.body.innerHTML = `<div id="host" style="width:${o.width}px;padding:8px 16px;box-sizing:border-box"></div>`;
    render(<TopBar title="A page" items={MENU_ITEMS} zoom={false} menuVariant={o.variant} />, host());
  },
  menuReport() {
    const menu = document.querySelector<HTMLElement>('[role="menu"]');
    const rows = menu ? [...menu.querySelectorAll<HTMLElement>(':scope > [data-slot="row"]')] : [];
    const more = menu?.closest('[data-boogy="popover"]') ?? null;
    const sub = [...document.querySelectorAll<HTMLElement>('[data-boogy="popover"]')].find((p) => p !== more) ?? null;
    return {
      more: rect(more),
      moreEdge: more ? getComputedStyle(more).borderTopColor : null,
      sub: rect(sub),
      subPlacement: sub?.dataset.placement ?? null,
      subHasPicker: !!sub?.querySelector('[data-boogy="color-picker"]'),
      focusInSub: !!sub?.contains(document.activeElement),
      rows: rows.map((row) => {
        const cs = getComputedStyle(row);
        const line = getComputedStyle(row, '::before');
        return {
          kind: row.dataset.boogy,
          text: row.querySelector('[data-slot="label"]')?.textContent ?? '',
          box: rect(row),
          paddingRight: Number.parseFloat(cs.paddingRight),
          background: cs.backgroundColor,
          expanded: row.getAttribute('aria-expanded'),
          icon: rect(row.querySelector('[data-slot="icon"] svg')),
          label: rect(row.querySelector('[data-slot="label"]')),
          chevron: rect(row.querySelector('[data-slot="submenu-indicator"] svg')),
          line: { content: line.content, height: line.height, top: line.top, color: line.backgroundColor, left: line.left, right: line.right },
        };
      }),
    };
  },
};
