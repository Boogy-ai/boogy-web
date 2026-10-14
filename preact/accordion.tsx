import { createContext, type ComponentChildren, type JSX } from 'preact';
import { useContext, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { accordion } from '@boogy/web';
import { Glyph } from './glyphs';

/** One item: its header's label, an optional trailing note (a count, a
 *  status), and what opens under it — any content, another Accordion for a
 *  second level. */
export type AccordionItem = {
  id: string;
  label: ComponentChildren;
  /** A glyph drawn before the label (`<Glyph shape="pencil" />`), muted, at
   *  the icon size; hidden from assistive tech, as the label names the item. */
  icon?: ComponentChildren;
  meta?: ComponentChildren;
  content: ComponentChildren;
};

export type AccordionProps = {
  /** The group's name, for assistive technology ("Components"). */
  label: string;
  items: readonly AccordionItem[];
  /** Controlled: the ids of the open items. Omit it to let the Accordion keep them. */
  open?: readonly string[];
  /** The items open at first, when the Accordion keeps them. */
  defaultOpen?: readonly string[];
  /** Every change of which items are open: the new ids, in the order they opened. */
  onOpenChange?: (open: string[]) => void;
  /** Only one item open at a time: opening one closes the others. */
  single?: boolean;
  /** How an item opens the Accordion nested in it, each time it is opened:
   *  `"all"` its items open, `"first"` only its first, `"none"` all closed.
   *  Unset, the nested one keeps its own `defaultOpen`. A nested Accordion
   *  given `open` is the app's, and is left alone. */
  nestedOpen?: NestedOpen;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'label' | 'open'>;

export type NestedOpen = 'all' | 'first' | 'none';

/** What an item tells the Accordion nested in it: the mode, and how many
 *  times the item has opened, so each opening applies it afresh. Every
 *  Accordion provides its own to its items (null without `nestedOpen`), so it
 *  reaches one level down, never two. */
const Nested = createContext<{ mode: NestedOpen; opened: number } | null>(null);

const openFor = (mode: NestedOpen, ids: readonly string[]): string[] =>
  mode === 'all' ? [...ids] : mode === 'first' ? ids.slice(0, 1) : [];

/** The headers of THIS level: a nested Accordion's are its own. */
const triggersOf = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(':scope > details > summary[data-slot="trigger"]'));

/** Items that open and close in place. See `accordion()`. */
export function Accordion({ label, items, open, defaultOpen = [], onOpenChange, single = false, nestedOpen, ...rest }: AccordionProps) {
  const [kept, setKept] = useState<readonly string[]>(defaultOpen);
  const shown = open ?? kept;
  // THE TIMES EACH ITEM HAS OPENED, counted as it appears among the open ones
  // (by a press, or by the app's `open`), for the Accordion nested in it.
  const opened = useRef(new Map<string, number>());
  const wasShown = useRef<readonly string[]>([]);
  for (const id of shown) if (!wasShown.current.includes(id)) opened.current.set(id, (opened.current.get(id) ?? 0) + 1);
  wasShown.current = shown;
  // As a nested Accordion: each opening of the item holding it applies its
  // mode, before the browser paints the item open.
  const nested = useContext(Nested);
  const ids = items.map((it) => it.id).join('\n');
  useLayoutEffect(() => {
    if (!nested || open !== undefined) return;
    const next = openFor(nested.mode, items.map((it) => it.id));
    latest.current = next;
    setKept(next);
  }, [nested?.opened, nested?.mode, ids]);
  // THE LATEST, not this render's: closing the others (single) fires their own
  // toggle events, whose handlers would otherwise read the list from before.
  const latest = useRef(shown);
  latest.current = shown;
  const change = (id: string, isOpen: boolean) => {
    const now = latest.current;
    if (isOpen === now.includes(id)) return;
    const next = isOpen ? (single ? [id] : [...now, id]) : now.filter((x) => x !== id);
    latest.current = next;
    if (open === undefined) setKept(next);
    onOpenChange?.(next);
  };
  return (
    <div
      {...rest}
      {...accordion()}
      role="group"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const root = e.currentTarget as HTMLElement;
        const heads = triggersOf(root);
        const at = heads.indexOf(e.target as HTMLElement);
        if (at < 0) return;
        const to = e.key === 'ArrowDown' ? Math.min(at + 1, heads.length - 1)
          : e.key === 'ArrowUp' ? Math.max(at - 1, 0)
          : e.key === 'Home' ? 0
          : e.key === 'End' ? heads.length - 1
          : null;
        if (to === null) return;
        e.preventDefault();
        heads[to].focus();
      }}
    >
      {items.map((it) => (
        <details
          key={it.id}
          data-slot="item"
          open={shown.includes(it.id)}
          onToggle={(e) => change(it.id, (e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary data-slot="trigger">
            {it.icon !== undefined && <span data-slot="icon" aria-hidden="true">{it.icon}</span>}
            <span data-slot="label">{it.label}</span>
            {it.meta !== undefined && <span data-slot="meta">{it.meta}</span>}
            <Glyph shape="forward" size="sm" data-slot="chevron" />
          </summary>
          <div data-slot="content">
            <Nested.Provider value={nestedOpen ? { mode: nestedOpen, opened: opened.current.get(it.id) ?? 0 } : null}>
              {it.content}
            </Nested.Provider>
          </div>
        </details>
      ))}
    </div>
  );
}
