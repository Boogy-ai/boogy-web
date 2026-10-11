import type { ComponentChildren, JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { accordion } from '@boogy/web';
import { Glyph } from './glyphs';

/** One item: its header's label, an optional trailing note (a count, a
 *  status), and what opens under it — any content, another Accordion for a
 *  second level. */
export type AccordionItem = {
  id: string;
  label: ComponentChildren;
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
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'label' | 'open'>;

/** The headers of THIS level: a nested Accordion's are its own. */
const triggersOf = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(':scope > details > summary[data-slot="trigger"]'));

/** Items that open and close in place. See `accordion()`. */
export function Accordion({ label, items, open, defaultOpen = [], onOpenChange, single = false, ...rest }: AccordionProps) {
  const [kept, setKept] = useState<readonly string[]>(defaultOpen);
  const shown = open ?? kept;
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
            <span data-slot="label">{it.label}</span>
            {it.meta !== undefined && <span data-slot="meta">{it.meta}</span>}
            <Glyph shape="forward" size="sm" data-slot="chevron" />
          </summary>
          <div data-slot="content">{it.content}</div>
        </details>
      ))}
    </div>
  );
}
