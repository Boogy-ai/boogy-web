// <SearchSelect>: choose one item from a set that grows, by searching it (see
// `searchSelect()`). Nothing is read until it opens; then a page at a time.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { field, searchSelect, searchSelectStep, type CursorPageOf } from '@boogy/web';
import { Glyph } from './glyphs';
import { PagedListEnd, usePagedList } from './paged-list';
import { Popover } from './popover';
import { SearchField } from './search-field';
import { useDebounced } from './use-debounced';
import { useId } from './use-id';

export type SearchSelectProps<T> = {
  /** The field's label, and the open list's name. */
  label: string;
  /** The chosen item, or `null` for none yet. */
  value: T | null;
  onChange: (item: T) => void;
  /** One page of the items matching `query` (every item for `''`), from
   *  `cursor`: the service's own search, never a filter over all of them. */
  load: (cursor: string | null, query: string) => Promise<CursorPageOf<T>>;
  /** A stable key for an item. */
  itemKey: (item: T) => string;
  /** An item's name, in words. */
  itemLabel: (item: T) => string;
  /** What a row (and the trigger) shows for an item; its name by default. */
  renderItem?: (item: T) => ComponentChildren;
  /** The trigger's words with nothing chosen. */
  placeholder?: string;
  /** The search field's name. Default "Search". */
  searchLabel?: string;
  /** Shown when nothing matches. */
  emptyText?: string;
  disabled?: boolean;
};

export function SearchSelect<T>({
  label, value, onChange, load, itemKey, itemLabel, renderItem, placeholder = 'Choose one', searchLabel = 'Search', emptyText = 'Nothing matches', disabled,
}: SearchSelectProps<T>) {
  const id = useId('select-');
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const show = renderItem ?? itemLabel;
  return (
    <div {...field()}>
      <label data-slot="label" id={`${id}-label`} for={id}>{label}</label>
      <button ref={trigger} id={id} type="button" data-slot="control" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open ? 'true' : 'false'} aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => setOpen(!open)}>
        <span data-slot="value" id={`${id}-value`}>{value ? show(value) : placeholder}</span>
        <Glyph shape="chevron-down" size="sm" data-slot="chevron" />
      </button>
      <Popover triggerRef={trigger} isOpen={open} onOpenChange={setOpen} placement="bottom start" title={label}>
        <Results label={label} chosen={value ? itemKey(value) : null} load={load} itemKey={itemKey} show={show}
          searchLabel={searchLabel} emptyText={emptyText} onPick={(item) => { setOpen(false); onChange(item); }} />
      </Popover>
    </div>
  );
}

/** The open list: mounted only while open, so it reads only then, and starts
 *  from the first page each time. */
function Results<T>({ label, chosen, load, itemKey, show, searchLabel, emptyText, onPick }: {
  label: string;
  chosen: string | null;
  load: (cursor: string | null, query: string) => Promise<CursorPageOf<T>>;
  itemKey: (item: T) => string;
  show: (item: T) => ComponentChildren;
  searchLabel: string;
  emptyText: string;
  onPick: (item: T) => void;
}) {
  const [text, setText] = useState('');
  const query = useDebounced(text.trim());
  const list = usePagedList<T>((cursor) => load(cursor, query), [query]);
  const [active, setActive] = useState(-1);
  useEffect(() => setActive(-1), [query]);
  const listId = useId('options-');
  const optionId = (i: number) => `${listId}-${i}`;
  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => searchSelectStep(a, list.items.length, e.key));
    } else if (e.key === 'Enter' && active >= 0 && active < list.items.length) {
      e.preventDefault();
      onPick(list.items[active]);
    }
  };
  return (
    <div {...searchSelect()}>
      <div data-slot="search">
        <SearchField label={searchLabel} placeholder={searchLabel} value={text} onValueChange={setText} autoFocus onKeyDown={onKeyDown}
          combobox={{ controls: listId, activeDescendant: active >= 0 ? optionId(active) : undefined }} />
      </div>
      <div data-slot="results">
        <div role="listbox" id={listId} aria-label={label} data-boogy="menu">
          {list.items.map((item, i) => {
            const key = itemKey(item);
            const on = key === chosen;
            return (
              <div key={key} id={optionId(i)} role="option" data-boogy="menu-item" aria-selected={on ? 'true' : 'false'}
                data-active={i === active ? 'true' : undefined} onPointerMove={() => setActive(i)} onClick={() => onPick(item)}>
                <span data-slot="label">{show(item)}</span>
                {on && <span data-slot="indicator"><Glyph shape="check" size="sm" /></span>}
              </div>
            );
          })}
        </div>
        {list.error != null && <p data-slot="empty" role="alert">Couldn't load these. Try again.</p>}
        {list.done && list.items.length === 0 && <p data-slot="empty">{emptyText}</p>}
        <PagedListEnd loading={list.loading} done={list.done} onMore={list.loadMore} label="More" />
      </div>
    </div>
  );
}
