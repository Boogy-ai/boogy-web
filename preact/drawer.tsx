// Drawer components for Preact apps, over the core `drawerLayout()` /
// `drawerItem()` attributes and the foundation stylesheet. The layout owns the
// app's two pieces of state (`expanded` for docked, `open` for overlay); the
// stylesheet decides which mode applies; these components add only what CSS
// cannot: the toggle's choice of state, Escape and backdrop to close, and focus
// moving in, staying in, and coming back while the overlay is open.
import { createContext, type ComponentChildren, type JSX } from 'preact';
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Button } from './button';
import { Glyph } from './glyphs';
import { TAB_STOPS, trapTab } from './tab-stops';
import { drawerItem, drawerLayout, drawerMode, monogram, type ButtonSize, type DrawerBreakpoint, type DrawerItemVariant, type DrawerSide, type DrawerVariant } from '@boogy/web';

interface DrawerState {
  expanded: boolean;
  open: boolean;
  setExpanded: (v: boolean) => void;
  setOpen: (v: boolean) => void;
  drawer: { current: HTMLElement | null };
  toggle: { current: HTMLElement | null };
  /** The side its drawer is on: a toggle points the way it goes. */
  side: DrawerSide;
}

const Ctx = createContext<DrawerState | null>(null);
function useDrawer(name: string): DrawerState {
  const s = useContext(Ctx);
  if (!s) throw new Error(`<${name}> must be inside <DrawerLayout>`);
  return s;
}

/** A layout's drawer, to drive from outside it: a toggle for rooms in a bar
 *  that sits inside a nested layout (members), whose own drawer is nearer. */
export type DrawerHandle = { readonly __drawer: DrawerState };

/** The drawer of the layout around the caller, as a handle a `DrawerToggle`
 *  anywhere can drive (`drawer={handle}`). */
export function useDrawerHandle(): DrawerHandle {
  return { __drawer: useDrawer('useDrawerHandle') };
}

/** The mode the stylesheet gives a drawer, `docked` beside the main area or
 *  `overlay` laid over it, kept current as the layout is resized across its
 *  breakpoint; `null` until the drawer is in the document. For what only a
 *  laid-over drawer needs: a bar's button that opens it. Default the drawer
 *  of the layout around the caller. */
export function useDrawerMode(drawer?: DrawerHandle): 'docked' | 'overlay' | null {
  const nearest = useContext(Ctx);
  const s = drawer?.__drawer ?? nearest;
  if (!s) throw new Error('useDrawerMode() must be inside <DrawerLayout>, or given a `drawer`');
  const [mode, setMode] = useState<'docked' | 'overlay' | null>(null);
  useLayoutEffect(() => {
    const el = s.drawer.current;
    const read = () => setMode(s.drawer.current ? drawerMode(s.drawer.current) : null);
    read();
    if (!el?.parentElement || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, []);
  return mode;
}

export type DrawerLayoutProps = {
  side?: DrawerSide;
  collapseAt?: DrawerBreakpoint;
  /** Docked mode: full column (true) or icon strip (false). Default true. */
  expanded?: boolean;
  /** Overlay mode: slid open over the main area. Default false. */
  open?: boolean;
  /** Animate expand/collapse and open/close. Default true. */
  animate?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onOpenChange?: (open: boolean) => void;
  /** Docked and expanded, the drawer's edge can be dragged to resize it. */
  resizable?: boolean;
  /** The expanded docked width in px. Unset: the stylesheet's default. */
  width?: number;
  /** Reported once, when a drag is released or an arrow key is pressed. */
  onWidthChange?: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'open'>;

const DEFAULT_MIN_WIDTH = 160;
const DEFAULT_MAX_WIDTH = 480;
/** An arrow key moves the edge by this share of the layout, as a pane seam does. */
const KEY_STEP = 0.05;

export function DrawerLayout({
  side, collapseAt, expanded = true, open = false, animate, onExpandedChange, onOpenChange,
  resizable, width, onWidthChange, minWidth = DEFAULT_MIN_WIDTH, maxWidth = DEFAULT_MAX_WIDTH, children, ...rest
}: DrawerLayoutProps) {
  const drawer = useRef<HTMLElement | null>(null);
  const toggle = useRef<HTMLElement | null>(null);
  const layout = useRef<HTMLDivElement | null>(null);

  // The width is a custom property on the layout, written here rather than
  // through `style` so a caller's own style prop is left alone.
  useLayoutEffect(() => {
    const el = layout.current;
    if (!el) return;
    if (width === undefined) el.style.removeProperty('--drawer-width');
    else el.style.setProperty('--drawer-width', `${width}px`);
  }, [width]);
  const state: DrawerState = {
    side: side ?? 'start',
    expanded, open, drawer, toggle,
    setExpanded: (v) => onExpandedChange?.(v),
    setOpen: (v) => onOpenChange?.(v),
  };
  return (
    <Ctx.Provider value={state}>
      <div
        {...rest}
        {...drawerLayout({ side, collapseAt, expanded, open, animate })}
        data-resizable={resizable ? 'true' : undefined}
        ref={layout}
      >
        {children}
        {resizable && (
          <DrawerResizer
            layout={layout} end={side === 'end'} width={width}
            min={minWidth} max={maxWidth} onWidthChange={onWidthChange}
          />
        )}
        <div data-boogy="drawer-backdrop" aria-hidden="true" onClick={() => state.setOpen(false)} />
      </div>
    </Ctx.Provider>
  );
}

/** The drawer's edge as a drag handle. Same contract as a pane seam: the drag
 *  writes the layout's style directly and reports nothing until release, so a
 *  drag costs no render and no persistence per frame. */
function DrawerResizer({ layout, end, width, min, max, onWidthChange }: {
  layout: { current: HTMLDivElement | null };
  end: boolean;
  width?: number;
  min: number;
  max: number;
  onWidthChange?: (width: number) => void;
}) {
  const pending = useRef<number | null>(null);
  const dragging = useRef(false);
  const clamp = (w: number) => Math.round(Math.min(max, Math.max(min, w)));

  const stop = (handle: HTMLElement) => {
    dragging.current = false;
    delete handle.dataset.active;
    if (layout.current) delete layout.current.dataset.resizing;
    const w = pending.current;
    pending.current = null;
    if (w !== null) onWidthChange?.(w);
  };

  return (
    <div
      data-boogy="drawer-resizer"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label="Resize navigation"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={(e: PointerEvent) => {
        const handle = e.currentTarget as HTMLElement;
        dragging.current = true;
        handle.dataset.active = 'true';
        if (layout.current) layout.current.dataset.resizing = 'true';
        if (e.pointerId != null) handle.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e: PointerEvent) => {
        const el = layout.current;
        if (!dragging.current || !el) return;
        const rect = el.getBoundingClientRect();
        const w = clamp(end ? rect.right - e.clientX : e.clientX - rect.left);
        pending.current = w;
        el.style.setProperty('--drawer-width', `${w}px`);
      }}
      onPointerUp={(e: PointerEvent) => { if (dragging.current) stop(e.currentTarget as HTMLElement); }}
      onPointerCancel={(e: PointerEvent) => { if (dragging.current) stop(e.currentTarget as HTMLElement); }}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const el = layout.current;
        if (!el) return;
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const current = width ?? (el.querySelector('[data-boogy="drawer"]') as HTMLElement | null)?.getBoundingClientRect().width ?? min;
        const outward = (e.key === 'ArrowRight') !== end;
        onWidthChange?.(clamp(current + (outward ? 1 : -1) * KEY_STEP * rect.width));
      }}
    />
  );
}

export type DrawerProps = {
  /** The navigation landmark's name, e.g. "Boards". */
  label: string;
  /** Its head: kept at the top, on the drawer's own ground, while what is
   *  under it scrolls (a section's heading, say, with its count and toggle). */
  head?: ComponentChildren;
  /** Its foot: kept at the drawer's bottom edge, on the drawer's own ground,
   *  while what is above it scrolls (actions, a toggle). On the collapsed
   *  strip it shows only its toggles and entries. */
  foot?: ComponentChildren;
  /** `plain`: docked, it sits on the page's ground with only its edge between
   *  (a second list beside the main one, a conversation's members); laid over
   *  the main area it keeps a ground. Default `panel`, a ground of its own. */
  variant?: DrawerVariant;
  children?: ComponentChildren;
} & JSX.HTMLAttributes<HTMLElement>;

export function Drawer({ label, head, foot, variant = 'panel', children, ...rest }: DrawerProps) {
  const s = useDrawer('Drawer');
  const overlayOpen = () => s.open && s.drawer.current !== null && drawerMode(s.drawer.current) === 'overlay';

  // Opening the overlay moves focus in; closing it returns focus to the toggle.
  const wasOpen = useRef(s.open);
  useEffect(() => {
    const el = s.drawer.current;
    if (!el) return;
    if (s.open && !wasOpen.current && drawerMode(el) === 'overlay') {
      (el.querySelector<HTMLElement>(TAB_STOPS) ?? el).focus();
    }
    if (!s.open && wasOpen.current && el.contains(document.activeElement)) {
      s.toggle.current?.focus();
    }
    if (!s.open && wasOpen.current && document.activeElement === document.body) {
      s.toggle.current?.focus();
    }
    wasOpen.current = s.open;
  }, [s.open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!overlayOpen()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      s.setOpen(false);
      return;
    }
    trapTab(e, s.drawer.current!);
  };

  return (
    <nav
      {...rest}
      data-boogy="drawer"
      data-variant={variant === 'plain' ? 'plain' : undefined}
      aria-label={label}
      tabIndex={-1}
      ref={(el: HTMLElement | null) => { s.drawer.current = el; }}
      onKeyDown={onKeyDown}
    >
      {(head != null && head !== false) || (foot != null && foot !== false) ? (
        <>
          {/* With a head or a foot, the body scrolls and they stay put, so
              neither needs a ground of its own. */}
          {head != null && head !== false && <div data-slot="head">{head}</div>}
          <div data-slot="body">{children}</div>
          {foot != null && foot !== false && <div data-slot="foot">{foot}</div>}
        </>
      ) : children}
    </nav>
  );
}

export function DrawerMain({ children, ...rest }: { children?: ComponentChildren } & JSX.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} data-boogy="drawer-main">{children}</div>;
}

type ItemElement = 'a' | 'button';
export type DrawerItemProps<T extends ItemElement = 'a'> = {
  as?: T;
  /** The entry's name: shown when expanded, the tooltip and the accessible name when collapsed. */
  label: string;
  /** What the collapsed strip shows. Defaults to a monogram of the label;
   *  `false` draws no mark at all (a title entry for an app with no logo yet). */
  mark?: ComponentChildren | false;
  current?: boolean;
  /** `entry` (default) or `title`, the drawer's larger heading entry. */
  variant?: DrawerItemVariant;
} & Omit<JSX.IntrinsicElements[T], 'as' | 'label'>;

export function DrawerItem<T extends ItemElement = 'a'>({ as, label, mark, current, variant, ...rest }: DrawerItemProps<T>) {
  const Tag = (as ?? 'a') as 'a';
  return (
    <Tag {...(rest as object)} {...drawerItem({ current, variant })} title={label}>
      {mark !== false && (
        <span data-slot="mark" aria-hidden="true">
          {mark ?? <span data-slot="initials">{monogram(label)}</span>}
        </span>
      )}
      <span data-slot="label">{label}</span>
    </Tag>
  );
}

/** Drawn pointing toward the drawer's own edge (collapse); the stylesheet
 *  turns it to point away when collapsed, and mirrors it for an end drawer. */
function Chevron() {
  return <Glyph shape="back" data-slot="chevron" />;
}

export type DrawerToggleProps = {
  children?: ComponentChildren;
  /** Its button's size: `sm` among a dense bar's buttons. Default `md`. */
  size?: ButtonSize;
  /** Shown in one state only: `expanded` while the drawer is open (docked
   *  and expanded, or overlaid), `collapsed` only on its strip. Unset: both.
   *  A drawer can then collapse from its head and expand from its foot. */
  shown?: 'expanded' | 'collapsed';
  /** Its accessible name, opening and closing. Default: "Show navigation" and
   *  "Hide navigation". */
  label?: { show: string; hide: string };
  /** Something new behind it (a room with messages not read): a dot on it,
   *  and "(new)" in its name. */
  unread?: boolean;
  /** The drawer it drives, from `useDrawerHandle`. Default the drawer of the
   *  layout it is inside. */
  drawer?: DrawerHandle;
} & Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'size' | 'label'>;

/** One button for both modes: it expands/collapses a docked drawer and
 *  opens/closes an overlaid one, whichever the stylesheet says applies. */
export function DrawerToggle({ children, shown, label = { show: 'Show navigation', hide: 'Hide navigation' }, unread = false, drawer, ...rest }: DrawerToggleProps) {
  const nearest = useContext(Ctx);
  const s = drawer?.__drawer ?? nearest;
  if (!s) throw new Error('<DrawerToggle> must be inside <DrawerLayout>, or given a `drawer`');
  const docked = () => s.drawer.current !== null && drawerMode(s.drawer.current) === 'docked';
  const on = useDrawerMode(drawer) === 'docked' ? s.expanded : s.open;
  return (
    <Button
      {...rest}
      variant="quiet"
      shape="icon"
      label={`${on ? label.hide : label.show}${unread ? ' (new)' : ''}`}
      data-role="drawer-toggle"
      data-side={s.side}
      data-shown={shown}
      aria-expanded={on ? 'true' : 'false'}
      ref={(el: HTMLElement | null) => { s.toggle.current = el; }}
      onClick={() => (docked() ? s.setExpanded(!s.expanded) : s.setOpen(!s.open))}
    >
      {children ?? <Chevron />}
      {unread && <span data-slot="unread" aria-hidden="true" />}
    </Button>
  );
}
