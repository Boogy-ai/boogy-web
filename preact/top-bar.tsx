// <TopBar>: the bar across the top of a surface — a title area on the start
// side, actions and widgets on the end side, and a "More" menu for what does
// not fit. See `topBar()` for the rules. It builds in the page's size control,
// in the menu by default (`zoom`); an app with a size control of its own
// passes `zoom={false}`.
//
// Every item the bar may show is also laid out, hidden, in a measuring row, so
// its width is known whether it is in the bar or in the menu; the bar's own box
// and that row are both observed, so the fit runs again when the bar resizes
// and when its text does (a zoom).
import { h, type ComponentChildren, type JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
  fitTopBar, measureContentBox, menuItem, menuItemText, menuRows, moveInRows, observeSize, resolveLength, runRounds, topBar,
  type ButtonSize, type ButtonVariant, type RoundJob, type TopBarPlace,
} from '@boogy/web';
import { Button } from './button';
import { Glyph } from './glyphs';
import { Popover } from './popover';
import { useTypeahead } from './use-typeahead';
import { ZoomControls } from './zoom';

type ItemBase = {
  id: string;
  /** Its name: an action's label, and a widget's row in the menu. */
  label: string;
  /** 1 stays in the bar longest; the highest number moves to the menu first. */
  priority: number;
  /** `auto`: the bar while it fits, else the menu. `bar`: always the bar.
   *  `menu`: always the menu. Default `auto` for an action, `menu` for a widget. */
  place?: TopBarPlace;
};
export type TopBarAction = ItemBase & {
  onAction: () => void;
  /** Its look in the bar. Default `quiet`; `danger` is also the menu item's. */
  variant?: ButtonVariant;
  disabled?: boolean;
  widget?: undefined;
};
export type TopBarWidget = ItemBase & {
  /** A group of controls (size buttons, a switch): as it is in the bar, and
   *  in a labelled row in the menu, where its controls join the menu's keys
   *  and pressing them leaves it open. */
  widget: ComponentChildren;
  onAction?: undefined;
};
export type TopBarItem = TopBarAction | TopBarWidget;

export type TopBarProps = {
  title: ComponentChildren;
  /** The title's element. Default `h1`. */
  titleAs?: 'h1' | 'h2' | 'h3' | 'p';
  /** A short line under the title. */
  subtitle?: ComponentChildren;
  /** A control before the title: a Back or a Home. */
  leading?: ComponentChildren;
  items?: readonly TopBarItem[];
  /** The More button's name. Default "More". */
  moreLabel?: string;
  /** The bar's buttons. Default `md`. */
  size?: ButtonSize;
  /** The page's size control (its zoom): in the More menu (the default), in
   *  the bar, or `false` for none. An app that renders its own size control
   *  elsewhere passes `false`, or the control appears twice. */
  zoom?: 'menu' | 'bar' | false;
  /** The size control's name, and its row's in the menu. Default "Text size". */
  zoomLabel?: string;
} & Omit<JSX.HTMLAttributes<HTMLElement>, 'title' | 'size'>;

/** A widget, not an action: an action always has its `onAction`. */
const isWidget = (it: TopBarItem): it is TopBarWidget => it.onAction === undefined;
const placeOf = (it: TopBarItem): TopBarPlace => it.place ?? (isWidget(it) ? 'menu' : 'auto');
const ANY_CONTROL = 'button, input, select, textarea, a[href]';
const CONTROLS = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]';
/** The size control comes last of all: below every item the caller gives. */
const ZOOM_PRIORITY = Number.MAX_SAFE_INTEGER;

/** One item as it shows in the bar. */
function InBar({ item, size }: { item: TopBarItem; size: ButtonSize }) {
  if (isWidget(item)) return <>{item.widget}</>;
  return (
    <Button variant={item.variant ?? 'quiet'} size={size} disabled={item.disabled} onClick={item.onAction}>
      {item.label}
    </Button>
  );
}

/** The menu: plain items and widget rows. Up and Down move between rows,
 *  wrapping at the ends, Left, Right and Tab between a widget row's controls;
 *  Tab past them, or on a plain item, closes it (Escape is the popover's).
 *  Typing jumps to the row whose name starts with it, as the SDK's Dropdown
 *  does. Focus goes to the first row as it opens. */
function TopBarMenu({ rows, label, start, close }: { rows: readonly TopBarItem[]; label: string; start: 'first' | 'last'; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const typed = useTypeahead();
  /** Each row and its controls: the item itself, or a widget's controls;
   *  with `all`, disabled ones too. */
  const rowControls = (all = false) => Array.from(ref.current!.querySelectorAll<HTMLElement>(':scope > [data-slot="row"]'))
    .map((row) => ({
      row,
      controls: row.getAttribute('role') === 'menuitem'
        ? (row.dataset.disabled && !all ? [] : [row])
        : Array.from(row.querySelectorAll<HTMLElement>(all ? ANY_CONTROL : CONTROLS)),
    }));
  /** The rows with a control to reach. */
  const reachable = () => rowControls().filter((r) => r.controls.length > 0);
  const controls = () => reachable().map((r) => r.controls);
  // A widget's controls are the menu's items too: reached by its keys, never by Tab.
  useLayoutEffect(() => {
    for (const el of Array.from(ref.current!.querySelectorAll<HTMLElement>(`[data-boogy="menu-row"] :is(${CONTROLS})`))) {
      el.setAttribute('role', 'menuitem');
      el.tabIndex = -1;
    }
  });
  useLayoutEffect(() => {
    const all = controls();
    const target = start === 'last' ? all[all.length - 1]?.[0] : all[0]?.[0];
    (target ?? ref.current!).focus();
  }, []);
  // Focus stays in the menu: a control that becomes disabled under focus
  // (Larger at the largest size) drops it, so it moves to the nearest
  // enabled control in the same row, else to the menu. The row is kept by
  // element, not place: a size change can move more rows in above it.
  const last = useRef<{ row: HTMLElement; col: number } | null>(null);
  useLayoutEffect(() => {
    const menu = ref.current!;
    const controlsOf = (row: HTMLElement) => (row.getAttribute('role') === 'menuitem' ? [row] : Array.from(row.querySelectorAll<HTMLElement>(ANY_CONTROL)));
    const remember = () => {
      const row = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-slot="row"]');
      if (row && menu.contains(row)) last.current = { row, col: controlsOf(row).indexOf(document.activeElement as HTMLElement) };
    };
    const keep = () => {
      // Lost, or about to be: the browser moves focus off a disabled control
      // to the page only later, when it next draws.
      const at = document.activeElement as HTMLElement | null;
      if ((at && menu.contains(at) && !at.matches(':disabled')) || !last.current) return;
      const row = menu.contains(last.current.row) ? controlsOf(last.current.row) : [];
      const col = last.current.col;
      const near = row
        .map((el, i) => ({ el, d: Math.abs(i - col) }))
        .filter(({ el }) => el.matches(CONTROLS) && el.getAttribute('aria-disabled') !== 'true')
        .sort((a, b) => a.d - b.d)[0]?.el;
      (near ?? menu).focus();
    };
    menu.addEventListener('focusin', remember);
    const watch = new MutationObserver(keep);
    watch.observe(menu, { subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled'] });
    return () => {
      menu.removeEventListener('focusin', remember);
      watch.disconnect();
    };
  }, []);
  const onKeyDown = (e: KeyboardEvent) => {
    const all = controls();
    const row = all.findIndex((c) => c.includes(document.activeElement as HTMLElement));
    const col = row < 0 ? 0 : all[row].indexOf(document.activeElement as HTMLElement);
    const to = moveInRows(e.key, e.shiftKey, { row, col }, all.map((c) => c.length));
    if (to === 'close') {
      e.preventDefault();
      close();
      return;
    }
    if (to) {
      e.preventDefault();
      all[to.row][to.col]?.focus();
      return;
    }
    const search = typed(e, () => reachable().map((r) => menuItemText(r.row)), row);
    if (search) {
      e.preventDefault();
      if (search.hit !== null) all[search.hit][0]?.focus();
      return;
    }
    const target = e.target as HTMLElement;
    if ((e.key === 'Enter' || e.key === ' ') && target.getAttribute('role') === 'menuitem' && target.dataset.boogy === 'menu-item') {
      e.preventDefault();
      target.click();
    }
  };
  return (
    <div ref={ref} data-boogy="menu" role="menu" aria-label={label} tabIndex={-1} onKeyDown={onKeyDown}>
      {rows.map((it) =>
        isWidget(it) ? (
          <div key={it.id} data-slot="row" data-boogy="menu-row" role="group" aria-label={it.label}>
            <span data-slot="label" aria-hidden="true">{it.label}</span>
            <div data-slot="widget">{it.widget}</div>
          </div>
        ) : (
          <div
            key={it.id}
            data-slot="row"
            {...menuItem({ id: it.id, selectionMode: 'none', variant: it.variant === 'danger' ? 'danger' : 'default', disabled: it.disabled })}
            onClick={() => {
              if (it.disabled) return;
              close();
              it.onAction();
            }}
            onPointerMove={(e: PointerEvent) => {
              const el = e.currentTarget as HTMLElement;
              if (!it.disabled && document.activeElement !== el) el.focus();
            }}
          >
            <span data-slot="label">{it.label}</span>
          </div>
        ),
      )}
    </div>
  );
}

export function TopBar({ title, titleAs = 'h1', subtitle, leading, items: given = [], moreLabel = 'More', size = 'md', zoom = 'menu', zoomLabel = 'Text size', ...rest }: TopBarProps) {
  const items: readonly TopBarItem[] = zoom === false
    ? given
    : [...given, { id: 'zoom', label: zoomLabel, priority: ZOOM_PRIORITY, place: zoom, widget: <ZoomControls size="sm" label={zoomLabel} /> }];
  const ref = useRef<HTMLElement>(null);
  const leadRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // How the menu takes focus as it opens: ArrowUp on More opens it on its last row.
  const [start, setStart] = useState<'first' | 'last'>('first');
  // Until a fit has run, every item that may be in the bar is.
  const [inBar, setInBar] = useState<Set<string> | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const jobRef = useRef<RoundJob | null>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    const row = measureRef.current!;
    let next: Set<string> | null = null;
    const job: RoundJob = {
      el,
      start: () => {},
      write: () => {},
      read: () => {
        // A bar with no width is not laid out (hidden, or no layout at all):
        // its items stay where they are until it is.
        if (el.clientWidth === 0) {
          next = null;
          return true;
        }
        const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
        const itemGap = Number.parseFloat(getComputedStyle(actionsRef.current!).columnGap) || 0;
        const lead = leadRef.current ? leadRef.current.getBoundingClientRect().width + gap : 0;
        const titleMin = resolveLength(el, 'var(--top-bar-title-min)');
        const available = measureContentBox(el).inline - lead - titleMin - gap;
        const widths = new Map<string, number>();
        for (const m of Array.from(row.querySelectorAll<HTMLElement>('[data-item]'))) widths.set(m.dataset.item!, m.getBoundingClientRect().width);
        next = fitTopBar(
          itemsRef.current.map((it) => ({ id: it.id, priority: it.priority, place: placeOf(it), width: widths.get(it.id) ?? 0 })),
          available,
          widths.get('') ?? 0,
          itemGap,
        );
        return true;
      },
      finish: () => { if (next) setInBar(next); },
    };
    jobRef.current = job;
    const stopBar = observeSize(el, () => runRounds(job));
    const stopRow = observeSize(row, () => runRounds(job));
    return () => { stopBar(); stopRow(); };
  }, []);
  // The leading slot is watched too, from whenever it appears: a Back that
  // comes later takes room from the actions.
  const hasLeading = leading !== undefined;
  useLayoutEffect(() => {
    const el = leadRef.current;
    if (!el || !jobRef.current) return;
    const job = jobRef.current;
    return observeSize(el, () => runRounds(job));
  }, [hasLeading]);
  // A changed set of items is fitted again.
  const shape = items.map((it) => `${it.id}:${it.priority}:${placeOf(it)}:${it.label}`).join('|');
  const fitted = useRef(shape);
  useLayoutEffect(() => {
    if (fitted.current === shape) return;
    fitted.current = shape;
    if (jobRef.current) runRounds(jobRef.current);
  }, [shape]);

  const shown = (it: TopBarItem) => placeOf(it) !== 'menu' && (inBar ? inBar.has(it.id) : true);
  const rowIds = menuRows(items, new Set(items.filter(shown).map((it) => it.id)));
  const rows = rowIds.map((id) => items.find((it) => it.id === id)!);
  const menuOpen = open && rows.length > 0;
  // A menu that empties (everything fits again) closes, so it never opens
  // again by itself when items return.
  useEffect(() => {
    if (open && rows.length === 0) setOpen(false);
  }, [open, rows.length]);
  const Title = titleAs;
  return (
    <header ref={ref} {...rest} {...topBar()}>
      {leading !== undefined && <div ref={leadRef} data-slot="leading">{leading}</div>}
      <div data-slot="heading">
        {h(Title, { 'data-slot': 'title' }, title)}
        {subtitle !== undefined && <p data-slot="subtitle">{subtitle}</p>}
      </div>
      <div ref={actionsRef} data-slot="actions">
        {items.filter(shown).map((it) => <div key={it.id} data-item={it.id}><InBar item={it} size={size} /></div>)}
        {rows.length > 0 && (
          <Button
            ref={moreRef}
            data-slot="more"
            variant="quiet"
            shape="icon"
            size={size}
            label={moreLabel}
            aria-haspopup="menu"
            aria-expanded={menuOpen ? 'true' : 'false'}
            onClick={() => { setStart('first'); setOpen(!menuOpen); }}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
              e.preventDefault();
              setStart(e.key === 'ArrowUp' ? 'last' : 'first');
              setOpen(true);
            }}
          >
            <Glyph shape="more" />
          </Button>
        )}
      </div>
      {/* Every item the bar may show, as it would show there, and the More
          button: measured, never seen, never reached. */}
      <div data-slot="measure" aria-hidden="true" inert>
        <div ref={measureRef}>
          {items.filter((it) => placeOf(it) !== 'menu').map((it) => <div key={it.id} data-item={it.id}><InBar item={it} size={size} /></div>)}
          <div data-item=""><Button variant="quiet" shape="icon" size={size} label={moreLabel}><Glyph shape="more" /></Button></div>
        </div>
      </div>
      <Popover triggerRef={moreRef} isOpen={menuOpen} onOpenChange={setOpen} placement="bottom end" fullscreenBelow={false}>
        <TopBarMenu rows={rows} label={moreLabel} start={start} close={() => setOpen(false)} />
      </Popover>
    </header>
  );
}
