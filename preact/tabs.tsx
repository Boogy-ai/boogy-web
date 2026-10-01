import type { ComponentChildren, JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { tab, tabKey, tabs } from '@boogy/web';
import { useId } from './use-id';

export type TabItem = { id: string; label: ComponentChildren };

export type TabsProps = {
  /** The accessible name of the row of tabs. */
  label: string;
  items: readonly TabItem[];
  /** The id of the selected tab. */
  selected: string;
  onSelect: (id: string) => void;
  /** The selected tab's panel. */
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'onSelect' | 'label'>;

/** A row of tabs over the selected tab's panel. See `tabs()`. */
export function Tabs({ label, items, selected, onSelect, children, ...rest }: TabsProps) {
  const base = useId('boogy-tabs-');
  const list = useRef<HTMLDivElement>(null);
  const at = Math.max(0, items.findIndex((t) => t.id === selected));
  return (
    <div {...rest} {...tabs()}>
      <div
        data-slot="list"
        role="tablist"
        aria-label={label}
        ref={list}
        onKeyDown={(e) => {
          const next = tabKey(e.key, at, items.length);
          if (next === null) return;
          e.preventDefault();
          onSelect(items[next].id);
          list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
        }}
      >
        {items.map((t, i) => (
          <button key={t.id} id={`${base}-tab-${i}`} aria-controls={`${base}-panel`}
                  {...tab({ selected: i === at })} onClick={() => onSelect(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div data-slot="panel" role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${at}`}>
        {children}
      </div>
    </div>
  );
}
