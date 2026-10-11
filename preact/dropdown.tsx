// Dropdown for Preact apps: HeroUI v3's anatomy over React Aria's menu
// behaviour, on the SDK Popover.
//
//   <Dropdown>
//     <Dropdown.Trigger><Button>…</Button></Dropdown.Trigger>
//     <Dropdown.Popover>
//       <Dropdown.Menu onAction={…}>
//         <Dropdown.Item id="copy">
//           <span data-slot="label">Copy</span>
//           <span data-slot="description">…</span>
//           <kbd data-slot="kbd">⌘C</kbd>
//           <Dropdown.ItemIndicator />
//         </Dropdown.Item>
//         <Dropdown.Separator />
//         <Dropdown.Section title="…">…</Dropdown.Section>
//       </Dropdown.Menu>
//     </Dropdown.Popover>
//   </Dropdown>
//
// Focus is roving and DOM-driven: the menu finds its enabled items by query at
// the moment a key is pressed, so items need no registration and sections nest
// freely.
import { cloneElement, createContext, toChildArray, type ComponentChildren, type JSX, type VNode } from 'preact';
import { useContext, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { menuItem, menuItemText, moveFocus, type MenuItemVariant, type MenuSelectionMode } from '@boogy/web';
import { Popover, type PopoverProps } from './popover';
import { useId } from './use-id';
import { useTypeahead } from './use-typeahead';

type FocusStrategy = 'first' | 'last' | null;

interface DropdownState {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: { current: HTMLElement | null };
  triggerId: string;
  /** How the menu takes focus when it opens: set by the key that opened it. */
  focus: { current: FocusStrategy };
  /** An uncontrolled selection, kept HERE because the menu unmounts whenever
   *  the dropdown closes; kept in the menu, a choice would be forgotten the
   *  next time it opens. */
  kept: { current: Set<string> | null };
}
const DropdownCtx = createContext<DropdownState | null>(null);
function useDropdown(name: string): DropdownState {
  const s = useContext(DropdownCtx);
  if (!s) throw new Error(`<${name}> must be inside <Dropdown>`);
  return s;
}

export type DropdownProps = {
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ComponentChildren;
};

export function Dropdown({ isOpen, defaultOpen = false, onOpenChange, children }: DropdownProps) {
  const [own, setOwn] = useState(defaultOpen);
  const open = isOpen ?? own;
  const state: DropdownState = {
    open,
    setOpen: (v) => { if (isOpen === undefined) setOwn(v); onOpenChange?.(v); },
    triggerRef: useRef<HTMLElement | null>(null),
    triggerId: useId('dropdown-trigger-'),
    focus: useRef<FocusStrategy>(null),
    kept: useRef<Set<string> | null>(null),
  };
  return <DropdownCtx.Provider value={state}>{children}</DropdownCtx.Provider>;
}

export type DropdownTriggerProps = {
  children: VNode;
  /** What it opens, as announced: `menu` (the default), or `dialog` for
   *  content that is not a menu (a picker, a form). */
  haspopup?: 'menu' | 'dialog';
};

/** Wraps ONE element (usually a `<Button>`) and makes it open the menu: a press
 *  toggles it, ArrowDown/ArrowUp open it on the first/last item. */
function DropdownTrigger({ children, haspopup = 'menu' }: DropdownTriggerProps) {
  const s = useDropdown('Dropdown.Trigger');
  const child = toChildArray(children)[0] as VNode<Record<string, unknown>>;
  const own = child.props as { onClick?: (e: MouseEvent) => void; onKeyDown?: (e: KeyboardEvent) => void };
  return cloneElement(child, {
    id: s.triggerId,
    ref: (el: HTMLElement | null) => { s.triggerRef.current = el; },
    'aria-haspopup': haspopup,
    'aria-expanded': s.open ? 'true' : 'false',
    onClick: (e: MouseEvent) => {
      own.onClick?.(e);
      s.focus.current = null;
      s.setOpen(!s.open);
    },
    onKeyDown: (e: KeyboardEvent) => {
      own.onKeyDown?.(e);
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      s.focus.current = e.key === 'ArrowDown' ? 'first' : 'last';
      s.setOpen(true);
    },
  });
}

export type DropdownPopoverProps = Omit<PopoverProps, 'triggerRef' | 'isOpen' | 'onOpenChange'>;

function DropdownPopover({ placement = 'bottom start', children, ...rest }: DropdownPopoverProps) {
  const s = useDropdown('Dropdown.Popover');
  return (
    <Popover {...rest} placement={placement} triggerRef={s.triggerRef} isOpen={s.open} onOpenChange={s.setOpen}>
      {children}
    </Popover>
  );
}

interface MenuState {
  mode: MenuSelectionMode;
  selected: Set<string>;
  disabled: Set<string>;
  press: (id: string, itemAction?: () => void) => void;
}
const MenuCtx = createContext<MenuState | null>(null);

export type DropdownMenuProps = {
  onAction?: (key: string) => void;
  selectionMode?: MenuSelectionMode;
  selectedKeys?: Iterable<string>;
  defaultSelectedKeys?: Iterable<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  disallowEmptySelection?: boolean;
  disabledKeys?: Iterable<string>;
  /** Default: close, except when several items can be selected. */
  shouldCloseOnSelect?: boolean;
  /** Arrow keys wrap from the last item to the first. Default false. */
  shouldFocusWrap?: boolean;
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'onSelect'>;

const ITEMS = '[data-boogy="menu-item"]:not([data-disabled])';

function DropdownMenu({
  onAction, selectionMode = 'none', selectedKeys, defaultSelectedKeys, onSelectionChange,
  disallowEmptySelection, disabledKeys, shouldCloseOnSelect, shouldFocusWrap = false, children, ...rest
}: DropdownMenuProps) {
  const s = useDropdown('Dropdown.Menu');
  const ref = useRef<HTMLDivElement>(null);
  const [own, setOwn] = useState(() => s.kept.current ?? new Set(defaultSelectedKeys ?? []));
  const selected = selectedKeys ? new Set(selectedKeys) : own;
  const typed = useTypeahead();

  // On open: the key that opened it chose the item; a press focuses the menu.
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const items = Array.from(menu.querySelectorAll<HTMLElement>(ITEMS));
    const target = s.focus.current === 'first' ? items[0] : s.focus.current === 'last' ? items[items.length - 1] : menu;
    (target ?? menu).focus();
    s.focus.current = null;
  }, []);

  const press = (id: string, itemAction?: () => void) => {
    if (selectionMode !== 'none') {
      const next = new Set(selected);
      if (next.has(id)) {
        if (next.size === 1 && disallowEmptySelection) return;
        next.delete(id);
      } else {
        if (selectionMode === 'single') next.clear();
        next.add(id);
      }
      if (!selectedKeys) { setOwn(next); s.kept.current = next; }
      onSelectionChange?.(next);
    }
    itemAction?.();
    onAction?.(id);
    if (shouldCloseOnSelect ?? selectionMode !== 'multiple') s.setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const menu = ref.current!;
    const items = Array.from(menu.querySelectorAll<HTMLElement>(ITEMS));
    const index = items.indexOf(document.activeElement as HTMLElement);
    const to = moveFocus(e.key, index, items.length, shouldFocusWrap);
    if (to !== null) { e.preventDefault(); items[to].focus(); return; }
    if (e.key === 'Tab') { e.preventDefault(); s.setOpen(false); return; }
    const search = typed(e, () => items.map(menuItemText), index);
    if (search) {
      e.preventDefault();
      if (search.hit !== null) items[search.hit].focus();
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && index >= 0) { e.preventDefault(); items[index].click(); }
  };

  return (
    <MenuCtx.Provider value={{ mode: selectionMode, selected, disabled: new Set(disabledKeys ?? []), press }}>
      <div
        {...rest}
        ref={ref}
        data-boogy="menu"
        role="menu"
        aria-labelledby={s.triggerId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </MenuCtx.Provider>
  );
}

const ItemCtx = createContext<{ selected: boolean; mode: MenuSelectionMode }>({ selected: false, mode: 'none' });

export type DropdownItemProps = {
  id: string;
  /** Text for typeahead, when the item's label is not plain text. */
  textValue?: string;
  variant?: MenuItemVariant;
  isDisabled?: boolean;
  /** Called when this item is pressed, before the menu's own onAction. */
  onAction?: () => void;
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'id'>;

function DropdownItem({ id, textValue, variant, isDisabled, onAction, children, ...rest }: DropdownItemProps) {
  const m = useContext(MenuCtx);
  if (!m) throw new Error('<Dropdown.Item> must be inside <Dropdown.Menu>');
  const disabled = !!isDisabled || m.disabled.has(id);
  const selected = m.selected.has(id);
  return (
    <ItemCtx.Provider value={{ selected, mode: m.mode }}>
      <div
        {...rest}
        {...menuItem({ id, selectionMode: m.mode, selected, disabled, variant })}
        data-text-value={textValue}
        onClick={() => { if (!disabled) m.press(id, onAction); }}
        onPointerMove={(e: PointerEvent) => {
          const el = e.currentTarget as HTMLElement;
          if (!disabled && document.activeElement !== el) el.focus();
        }}
      >
        {children}
      </div>
    </ItemCtx.Provider>
  );
}

/** Shows the item's selection: a check (default) or a dot. Empty when unselected. */
function DropdownItemIndicator({ type = 'checkmark' }: { type?: 'checkmark' | 'dot' }) {
  const { selected } = useContext(ItemCtx);
  return (
    <span data-slot="indicator" aria-hidden="true">
      {selected && (type === 'dot'
        ? <svg viewBox="0 0 24 24" width="0.5em" height="0.5em"><circle cx="12" cy="12" r="12" fill="currentColor" /></svg>
        : <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>)}
    </span>
  );
}

function DropdownSection({ title, children }: { title?: string; children?: ComponentChildren }) {
  const headerId = useId('dropdown-section-');
  return (
    <div data-boogy="menu-section" role="group" aria-labelledby={title ? headerId : undefined}>
      {title && <div data-slot="header" id={headerId} role="presentation">{title}</div>}
      {children}
    </div>
  );
}

function DropdownSeparator() {
  return <div data-boogy="menu-separator" role="separator" />;
}

Dropdown.Trigger = DropdownTrigger;
Dropdown.Popover = DropdownPopover;
Dropdown.Menu = DropdownMenu;
Dropdown.Item = DropdownItem;
Dropdown.ItemIndicator = DropdownItemIndicator;
Dropdown.Section = DropdownSection;
Dropdown.Separator = DropdownSeparator;
