// <SplitView>: regions side by side when wide, tabs when narrow (see `splitView()`).
import type { ComponentChildren, JSX } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { splitView, tabId, type SplitBreakpoint } from '@boogy/web';
import { TabList } from './tabs';
import { useId } from './use-id';

export type SplitRegion = {
  id: string;
  /** Its name: its tab's label when narrow, and the region's name. */
  label: string;
  /** A count on its tab: a stored total, never the rows loaded so far. */
  count?: number;
  /** Beside the main region at its own width, when wide. */
  aside?: boolean;
  content: ComponentChildren;
};

export type SplitViewProps = {
  /** The name of the row of tabs it shows when narrow. */
  label: string;
  regions: readonly SplitRegion[];
  collapseAt?: SplitBreakpoint;
  /** The region shown when narrow; the first unless the caller says. */
  selected?: string;
  onSelect?: (id: string) => void;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'onSelect' | 'label'>;

export function SplitView({ label, regions, collapseAt, selected, onSelect, ...rest }: SplitViewProps) {
  const [own, setOwn] = useState(regions[0]?.id ?? '');
  // A selected id that is no region shows the first: never a blank screen.
  const wanted = selected ?? own;
  const shown = regions.some((r) => r.id === wanted) ? wanted : (regions[0]?.id ?? '');
  const panel = useId('split-');
  const multi = regions.length > 1;
  // Narrow is whatever the stylesheet decided (the tabs are drawn), read
  // after each change of size: the regions are then the tabs' panel.
  const root = useRef<HTMLDivElement>(null);
  const tabsEl = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(true);
  useLayoutEffect(() => {
    const el = root.current;
    const tabs = tabsEl.current;
    if (!el || !tabs) return;
    const update = () => setNarrow(getComputedStyle(tabs).display !== 'none');
    update();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [multi]);
  const asPanel = multi && narrow;
  const select = (id: string) => {
    if (selected === undefined) setOwn(id);
    onSelect?.(id);
  };
  return (
    <div {...rest} {...splitView({ collapseAt })} ref={root}>
      {/* One region has nothing to choose between: no row of tabs. */}
      {regions.length > 1 && (
        <div data-slot="tabs" ref={tabsEl}>
          <TabList label={label} panel={panel} selected={shown} onSelect={select}
            items={regions.map((r) => ({ id: r.id, label: r.label, count: r.count }))} />
        </div>
      )}
      <div data-slot="regions" id={panel} role={asPanel ? 'tabpanel' : undefined} aria-labelledby={asPanel ? tabId(panel, shown) : undefined}>
        {regions.map((r) => (
          <div key={r.id} data-slot="region" data-region={r.id} role="region" aria-label={r.label}
            data-selected={r.id === shown ? '' : undefined} data-aside={r.aside ? '' : undefined}>
            {r.content}
          </div>
        ))}
      </div>
    </div>
  );
}
