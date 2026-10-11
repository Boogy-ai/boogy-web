// <TopBar>: the bar across the top of a surface — a title area on the start
// side, actions, widgets and submenus on the end side, and a "More" menu for
// what does not fit, a faint line between each two of its rows. See
// `topBar()` for the rules. It builds in the page's size control, in the menu
// by default (`zoom`); an app with a size control of its own passes
// `zoom={false}`.
//
// Every item the bar may show is also laid out, hidden, in a measuring row, so
// its width is known whether it is in the bar or in the menu; the bar's own box
// and that row are both observed, so the fit runs again when the bar resizes
// and when its text does (a zoom).
import { h, type ComponentChildren, type JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
  fitTopBar, isTypingTarget, measureContentBox, menuItem, menuItemText, menuRows, moveInRows, observeSize, resolveLength, runRounds, topBar,
  type ButtonSize, type ButtonVariant, type PopoverVariant, type RoundJob, type TopBarPlace,
} from '@boogy/web';
import { Button } from './button';
import { Glyph } from './glyphs';
import { Popover } from './popover';
import { TabList, type TabListProps } from './tabs';
import { TAB_STOPS } from './tab-stops';
import { useId } from './use-id';
import { useTypeahead } from './use-typeahead';
import { ZoomControls } from './zoom';

type ItemBase = {
  id: string;
  /** Its name: an action's label, and a widget's row in the menu. */
  label: string;
  /** 1 stays in the bar longest; the highest number moves to the menu first. */
  priority: number;
  /** `auto`: the bar while it fits, else the menu. `bar`: always the bar.
   *  `menu`: always the menu. Default `auto` for an action or a submenu,
   *  `menu` for a widget. */
  place?: TopBarPlace;
};
export type TopBarAction = ItemBase & {
  onAction: () => void;
  /** Its look in the bar. Default `quiet`; `danger` is also the menu item's. */
  variant?: ButtonVariant;
  disabled?: boolean;
  /** A glyph. In the bar the action is then an icon-only button named by its label; in the menu the glyph leads its row. */
  icon?: ComponentChildren;
  widget?: undefined;
  submenu?: undefined;
};
export type TopBarWidget = ItemBase & {
  /** A group of controls (size buttons, a switch): as it is in the bar, and
   *  in a labelled row in the menu, where its controls join the menu's keys
   *  and pressing them leaves it open. */
  widget: ComponentChildren;
  /** What its row in the menu holds instead of `widget` (the same controls laid out for a menu). Default: `widget`. */
  menu?: ComponentChildren;
  /** A glyph that leads its row in the menu, as an action's does. In the bar the widget is as it is. */
  icon?: ComponentChildren;
  onAction?: undefined;
  submenu?: undefined;
};
export type TopBarSubmenu = ItemBase & {
  /** A glyph: all of its button in the bar, which its label names, and the
   *  lead of its row in the menu. */
  icon: ComponentChildren;
  /** What it opens (a picker, a form), which handles its own keys. In the bar
   *  its button opens it in a popover below. In the menu its row is one
   *  control ending in a chevron: a press, Enter, Space or Right opens it in a
   *  popover beside the row, Escape or a Left it leaves unhandled closes it
   *  back to the row, and the menu stays open. */
  submenu: ComponentChildren;
  onAction?: undefined;
  widget?: undefined;
};
export type TopBarItem = TopBarAction | TopBarWidget | TopBarSubmenu;

export type TopBarProps = ({
  title: ComponentChildren;
  tabs?: undefined;
} | {
  /** Tab switcher mode: a row of tabs in the heading, in the title's place
   *  (a page's sections, its body the selected one's \`TabPanel\`). */
  tabs: TabListProps;
  title?: undefined;
}) & {
  /** The title's element. Default `h1`. */
  titleAs?: 'h1' | 'h2' | 'h3' | 'p';
  /** A short line under the title. */
  subtitle?: ComponentChildren;
  /** A control before the title: a Back or a Home. */
  leading?: ComponentChildren;
  items?: readonly TopBarItem[];
  /** What the More button shows. Default the SDK's More glyph; an app may swap it for a moment to acknowledge an action taken from the menu. */
  moreGlyph?: ComponentChildren;
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
  /** The More menu's look: `flat` (default: edged, frosted, a small shadow) or `raised` (a large drop shadow). */
  menuVariant?: PopoverVariant;
  /** The ground of More and of every submenu: any CSS colour. Default the theme's. */
  menuGround?: string;
  /** A shadow below the bar (`--bar-shadow`), over what scrolls under it. Default none. */
  shadow?: boolean;
} & Omit<JSX.HTMLAttributes<HTMLElement>, 'title' | 'size'>;

const isSubmenu = (it: TopBarItem): it is TopBarSubmenu => it.submenu !== undefined;
/** A widget: not an action, which always has its `onAction`, nor a submenu. */
const isWidget = (it: TopBarItem): it is TopBarWidget => it.onAction === undefined && !isSubmenu(it);
const placeOf = (it: TopBarItem): TopBarPlace => it.place ?? (isWidget(it) ? 'menu' : 'auto');
const ANY_CONTROL = 'button, input, select, textarea, a[href]';
const CONTROLS = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]';
/** The size control comes last of all: below every item the caller gives. */
const ZOOM_PRIORITY = Number.MAX_SAFE_INTEGER;

/** A submenu in the bar: an icon-only button, named by its label, that opens
 *  the content in a popover below it, focus inside. Escape or a press outside
 *  closes it, focus back on the button. */
function BarSubmenu({ item, size, variant, ground }: { item: TopBarSubmenu; size: ButtonSize; variant: PopoverVariant; ground?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button ref={ref} variant="quiet" size={size} shape="icon" label={item.label} aria-haspopup="dialog" aria-expanded={open ? 'true' : 'false'} onClick={() => setOpen(!open)}>
        {item.icon}
      </Button>
      <Popover triggerRef={ref} isOpen={open} onOpenChange={setOpen} placement="bottom end" variant={variant} ground={ground} fullscreenBelow={false}>
        {item.submenu}
      </Popover>
    </>
  );
}

/** A submenu in the menu: ONE row that is itself the control, its glyph, its
 *  label and a chevron. A press (Enter and Space press it, through the menu's
 *  keys) or Right opens the content in a popover beside the row, on the other
 *  side when there is no room, and focus goes in; Escape, or a Left the
 *  content does not handle (a field's caret is the field's), closes it, focus
 *  back on the row, the menu still open. The content's keys are its own (the
 *  menu leaves anything inside a popover to it). Pointing at the row focuses
 *  it as any row; only a press opens it. Focus landing on another of the
 *  menu's rows closes it (the menu owns which one is open). Keys with Alt,
 *  Ctrl or Meta are the browser's, never handled. */
function SubmenuRow({ item, variant, ground, open, setOpen }: { item: TopBarSubmenu; variant: PopoverVariant; ground?: string; open: boolean; setOpen: (open: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const popoverId = useId('submenu-');
  return (
    <>
      <div
        ref={ref}
        data-slot="row"
        {...menuItem({ id: item.id, selectionMode: 'none' })}
        aria-haspopup="dialog"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key !== 'ArrowRight' || e.altKey || e.ctrlKey || e.metaKey) return;
          e.preventDefault();
          if (!open) setOpen(true);
          else document.getElementById(popoverId)?.querySelector<HTMLElement>(TAB_STOPS)?.focus();
        }}
        onPointerMove={(e: PointerEvent) => {
          // Open, focus is in the content: pointing back at the row leaves it there.
          const el = e.currentTarget as HTMLElement;
          if (!open && document.activeElement !== el) el.focus();
        }}
      >
        <span data-slot="icon" aria-hidden="true">{item.icon}</span>
        <span data-slot="label">{item.label}</span>
        <span data-slot="submenu-indicator" aria-hidden="true"><Glyph shape="forward" size="sm" /></span>
      </div>
      <Popover
        id={popoverId}
        triggerRef={ref}
        isOpen={open}
        onOpenChange={setOpen}
        placement="right start"
        variant={variant}
        ground={ground}
        fullscreenBelow={false}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key !== 'ArrowLeft' || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented || isTypingTarget(e.target)) return;
          e.preventDefault();
          setOpen(false);
        }}
      >
        {item.submenu}
      </Popover>
    </>
  );
}

/** One item as it shows in the bar. */
function InBar({ item, size, variant, ground }: { item: TopBarItem; size: ButtonSize; variant: PopoverVariant; ground?: string }) {
  if (isSubmenu(item)) return <BarSubmenu item={item} size={size} variant={variant} ground={ground} />;
  if (isWidget(item)) return <>{item.widget}</>;
  if (item.icon !== undefined) {
    return (
      <Button variant={item.variant ?? 'quiet'} size={size} shape="icon" label={item.label} disabled={item.disabled} onClick={item.onAction}>
        {item.icon}
      </Button>
    );
  }
  return (
    <Button variant={item.variant ?? 'quiet'} size={size} disabled={item.disabled} onClick={item.onAction}>
      {item.label}
    </Button>
  );
}

/** The menu: plain items, submenu rows and widget rows. Up and Down move
 *  between rows, wrapping at the ends, Left, Right and Tab between a widget
 *  row's controls; Tab past them, or on a plain item, closes it (Escape is
 *  the popover's). Typing jumps to the row whose name starts with it, as the
 *  SDK's Dropdown does. Focus goes to the first row as it opens. A submenu
 *  opens in a popover of `variant`, the menu's own. */
function TopBarMenu({ rows, label, start, variant, ground, close }: { rows: readonly TopBarItem[]; label: string; start: 'first' | 'last'; variant: PopoverVariant; ground?: string; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const typed = useTypeahead();
  /** The submenu row whose content is open: one at a time, closed as focus
   *  lands on any other of the menu's own rows. */
  const [openId, setOpenId] = useState<string | null>(null);
  /** Whether `el` is this menu's own, not inside a popover opened from one of
   *  its rows (a widget's own menu or picker): those controls belong to that
   *  popover, which steps, searches and traps Tab itself. A row's own control
   *  finds this menu's popover, around the menu; a nested one finds its own,
   *  inside it. */
  const own = (el: Element) => !ref.current!.contains(el.closest('[data-boogy="popover"]'));
  /** Each row and its controls: the item itself, or a widget's controls;
   *  with `all`, disabled ones too. */
  const rowControls = (all = false) => Array.from(ref.current!.querySelectorAll<HTMLElement>(':scope > [data-slot="row"]'))
    .map((row) => ({
      row,
      controls: row.getAttribute('role') === 'menuitem'
        ? (row.dataset.disabled && !all ? [] : [row])
        : Array.from(row.querySelectorAll<HTMLElement>(all ? ANY_CONTROL : CONTROLS)).filter(own),
    }));
  /** The rows with a control to reach. */
  const reachable = () => rowControls().filter((r) => r.controls.length > 0);
  const controls = () => reachable().map((r) => r.controls);
  // A widget's controls are the menu's items too: reached by its keys, never by Tab.
  useLayoutEffect(() => {
    for (const el of Array.from(ref.current!.querySelectorAll<HTMLElement>(`[data-boogy="menu-row"] :is(${CONTROLS})`)).filter(own)) {
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
    const controlsOf = (row: HTMLElement) => (row.getAttribute('role') === 'menuitem' ? [row] : Array.from(row.querySelectorAll<HTMLElement>(ANY_CONTROL)).filter(own));
    const remember = () => {
      const at = document.activeElement as HTMLElement | null;
      const row = at?.closest<HTMLElement>('[data-slot="row"]');
      if (at && row && menu.contains(row) && own(at)) {
        last.current = { row, col: controlsOf(row).indexOf(at) };
        if (row.getAttribute('aria-expanded') !== 'true') setOpenId(null);
      }
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
    // Already handled on its way here: a widget's own menu (a Dropdown opened
    // from a row) steps, searches and closes itself, and its key presses pass
    // through this menu after it has. And a key pressed inside a popover
    // opened from a row is that popover's, handled or not: Tab cycles in it,
    // a letter is typed into it.
    if (e.defaultPrevented || !own(e.target as Element)) return;
    // A browser shortcut (Alt+Left is Back) is not the menu's key.
    if (e.altKey || e.ctrlKey || e.metaKey) return;
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
        isSubmenu(it) ? (
          <SubmenuRow key={it.id} item={it} variant={variant} ground={ground} open={openId === it.id} setOpen={(o) => setOpenId(o ? it.id : null)} />
        ) : isWidget(it) ? (
          <div key={it.id} data-slot="row" data-boogy="menu-row" role="group" aria-label={it.label}>
            {it.icon !== undefined && <span data-slot="icon" aria-hidden="true">{it.icon}</span>}
            <span data-slot="label" aria-hidden="true">{it.label}</span>
            <div data-slot="widget">{it.menu ?? it.widget}</div>
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
            {it.icon !== undefined && <span data-slot="icon" aria-hidden="true">{it.icon}</span>}
            <span data-slot="label">{it.label}</span>
          </div>
        ),
      )}
    </div>
  );
}

export function TopBar({ title, tabs, titleAs = 'h1', subtitle, leading, items: given = [], moreLabel = 'More', moreGlyph, size = 'md', zoom = 'menu', zoomLabel = 'Text size', menuVariant = 'flat', menuGround, shadow = false, ...rest }: TopBarProps) {
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
    <header ref={ref} {...rest} {...topBar({ shadow })}>
      {leading !== undefined && <div ref={leadRef} data-slot="leading">{leading}</div>}
      <div data-slot="heading">
        {tabs ? <TabList {...tabs} /> : h(Title, { 'data-slot': 'title' }, title)}
        {subtitle !== undefined && <p data-slot="subtitle">{subtitle}</p>}
      </div>
      <div ref={actionsRef} data-slot="actions">
        {items.filter(shown).map((it) => <div key={it.id} data-item={it.id}><InBar item={it} size={size} variant={menuVariant} ground={menuGround} /></div>)}
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
            {moreGlyph ?? <Glyph shape="more" />}
          </Button>
        )}
      </div>
      {/* Every item the bar may show, as it would show there, and the More
          button: measured, never seen, never reached. */}
      <div data-slot="measure" aria-hidden="true" inert>
        <div ref={measureRef}>
          {items.filter((it) => placeOf(it) !== 'menu').map((it) => <div key={it.id} data-item={it.id}><InBar item={it} size={size} variant={menuVariant} ground={menuGround} /></div>)}
          <div data-item=""><Button variant="quiet" shape="icon" size={size} label={moreLabel}>{moreGlyph ?? <Glyph shape="more" />}</Button></div>
        </div>
      </div>
      <Popover triggerRef={moreRef} isOpen={menuOpen} onOpenChange={setOpen} placement="bottom end" variant={menuVariant} ground={menuGround} fullscreenBelow={false}>
        <TopBarMenu rows={rows} label={moreLabel} start={start} variant={menuVariant} ground={menuGround} close={() => setOpen(false)} />
      </Popover>
    </header>
  );
}
