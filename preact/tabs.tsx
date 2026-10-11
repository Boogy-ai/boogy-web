import type { ComponentChildren, JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { tab, tabId, tabKey, tabList, tabPanel, tabs } from '@boogy/web';
import { useId } from './use-id';

export type TabItem = {
  id: string;
  label: ComponentChildren;
  /** A glyph before the label, in the tab's colour. Decoration: the label is
   *  the tab's name. */
  icon?: ComponentChildren;
};

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
 *  keys select as they move, wrapping; Home and End go to the ends. */
export function TabList({ label, items, selected, onSelect, fill, panel }: TabListProps) {
  const list = useRef<HTMLDivElement>(null);
  const at = Math.max(0, items.findIndex((t) => t.id === selected));
  return (
    <div
      {...tabList({ fill })}
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
