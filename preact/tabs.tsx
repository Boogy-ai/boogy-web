import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { tab, tabId, tabKey, tabList, tabPanel, tabRowMore, tabRowWheel, tabs } from '@boogy/web';
import { useId } from './use-id';

export type TabItem = {
  id: string;
  label: ComponentChildren;
  /** A glyph before the label, in the tab's colour. Decoration: the label is
   *  the tab's name. */
  icon?: ComponentChildren;
};

/** How far, in pixels, a mouse press on a row of tabs moves before it is a
 *  drag of the row rather than a click on a tab. */
const DRAG_SLOP = 4;

export type TabListProps = {
  /** The accessible name of the row of tabs. */
  label: string;
  items: readonly TabItem[];
  /** The id of the selected tab. */
  selected: string;
  onSelect: (id: string) => void;
  /** The tabs share the row's width evenly, rather than sitting together at
   *  its start. */
  fill?: boolean;
  /** The id of the panel the row controls (its `TabPanel`). */
  panel: string;
};

/** The row of tabs alone: shown apart from its panel (in a top bar, say),
 *  linked to it by the panel's id. One tab stop, the selected tab; the arrow
 *  keys select as they move, wrapping; Home and End go to the ends.
 *
 *  TOO MANY TO FIT, as Android's scrollable tabs: the row scrolls sideways with
 *  no scrollbar, each tab keeps its label whole, the row fades out at a side
 *  with more beyond it (`data-more-left` / `data-more-right`, kept by scroll,
 *  resize and a change of the tabs' size), and the selected tab is brought to
 *  the middle of the row, within the row only (never scrolling the page). A
 *  finger swipes the row; a mouse drags it, or turns its wheel over it, until
 *  the row reaches an end and the wheel scrolls the page again. */
export function TabList({ label, items, selected, onSelect, fill, panel }: TabListProps) {
  const list = useRef<HTMLDivElement>(null);
  const at = Math.max(0, items.findIndex((t) => t.id === selected));
  const [more, setMore] = useState({ left: false, right: false });
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const update = () => {
      const next = tabRowMore(el.scrollLeft, el.clientWidth, el.scrollWidth);
      setMore((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    for (const t of Array.from(el.children)) ro?.observe(t);
    return () => { el.removeEventListener('scroll', update); ro?.disconnect(); };
  }, [items]);
  // The gestures, set up once: an app commonly passes new tabs on every render,
  // and rebuilding these mid-drag would drop the drag.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    // A mouse wheel turned up or down moves the row sideways (a pinch, which
    // arrives with Ctrl held, is the page's zoom).
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const by = tabRowWheel(e, el, parseFloat(getComputedStyle(el).fontSize));
      if (by === null) return;
      e.preventDefault();
      el.scrollLeft += by;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    // A mouse drags the row as a finger swipes it (touch scrolls natively). A
    // press becomes a drag once it moves DRAG_SLOP pixels; the click a drag
    // ends with chooses no tab.
    let drag: { id: number; x: number; left: number; moved: boolean } | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || el.scrollWidth <= el.clientWidth) return;
      drag = { id: e.pointerId, x: e.clientX, left: el.scrollLeft, moved: false };
    };
    const end = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const moved = drag.moved;
      drag = null;
      if (!moved) return;
      el.removeAttribute('data-dragging');
      if (e.type !== 'pointerup') return;
      const swallow = (c: MouseEvent) => { c.stopPropagation(); c.preventDefault(); };
      el.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!(e.buttons & 1)) { end(e); return; }
      const dx = e.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(dx) < DRAG_SLOP) return;
        drag.moved = true;
        el.setPointerCapture?.(e.pointerId);
        el.setAttribute('data-dragging', '');
      }
      el.scrollLeft = drag.left - dx;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    return () => {
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
    };
  }, []);
  // The selected tab to the middle of the row: at once the first time, smoothly
  // after (at once under reduced motion).
  const placed = useRef(false);
  useEffect(() => {
    const el = list.current;
    const t = el?.querySelectorAll<HTMLElement>('[role="tab"]')[at];
    if (!el || !t) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max > 0) {
      const left = Math.max(0, Math.min(max, t.offsetLeft + t.offsetWidth / 2 - el.clientWidth / 2));
      const still = !placed.current || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (el.scrollTo) el.scrollTo({ left, behavior: still ? 'auto' : 'smooth' });
      else el.scrollLeft = left;
    }
    placed.current = true;
  }, [at]);
  return (
    <div
      {...tabList({ fill })}
      aria-label={label}
      ref={list}
      data-more-left={more.left ? '' : undefined}
      data-more-right={more.right ? '' : undefined}
      onKeyDown={(e) => {
        const next = tabKey(e.key, at, items.length);
        if (next === null) return;
        e.preventDefault();
        onSelect(items[next].id);
        // The row scrolls it to the middle itself (above), not the focus.
        list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus({ preventScroll: true });
      }}
    >
      {items.map((t, i) => (
        <button key={t.id} id={tabId(panel, t.id)} aria-controls={panel}
                {...tab({ selected: i === at })} onClick={() => onSelect(t.id)}>
          {t.icon !== undefined && <span data-slot="icon" aria-hidden="true">{t.icon}</span>}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export type TabPanelProps = {
  /** Its id: the one its row names as \`panel\`. */
  id: string;
  /** The id of the selected tab, which labels it. */
  selected: string;
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'id'>;

/** The selected tab's panel, shown apart from its row. */
export function TabPanel({ id, selected, children, ...rest }: TabPanelProps) {
  return (
    <div {...rest} {...tabPanel()} id={id} aria-labelledby={tabId(id, selected)}>
      {children}
    </div>
  );
}

export type TabsProps = Omit<TabListProps, 'panel'> & {
  /** The selected tab's panel. */
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'onSelect' | 'label'>;

/** A row of tabs over the selected tab's panel. See `tabs()`. */
export function Tabs({ label, items, selected, onSelect, fill, children, ...rest }: TabsProps) {
  const panel = `${useId('boogy-tabs-')}-panel`;
  const shown = items.some((t) => t.id === selected) ? selected : items[0]?.id ?? '';
  return (
    <div {...rest} {...tabs()}>
      <TabList label={label} items={items} selected={selected} onSelect={onSelect} fill={fill} panel={panel} />
      <TabPanel data-slot="panel" id={panel} selected={shown}>{children}</TabPanel>
    </div>
  );
}
