import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { Dropdown, Button, Menu } from './index';

afterEach(() => { document.body.replaceChildren(); });

const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); });

function mount(menuProps: Record<string, unknown> = {}, dropdownProps: Record<string, unknown> = {}) {
  const onAction = vi.fn();
  const onSelectionChange = vi.fn();
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(
    <Dropdown {...dropdownProps}>
      <Dropdown.Trigger><Button label="Actions">⋯</Button></Dropdown.Trigger>
      <Dropdown.Popover title="Actions">
        <Dropdown.Menu aria-label="Actions" onAction={onAction} onSelectionChange={onSelectionChange} {...menuProps}>
          <Dropdown.Item id="copy"><span data-slot="label">Copy</span><kbd data-slot="kbd">⌘C</kbd><Dropdown.ItemIndicator /></Dropdown.Item>
          <Dropdown.Item id="cut" isDisabled><span data-slot="label">Cut</span></Dropdown.Item>
          <Dropdown.Item id="paste"><span data-slot="label">Paste</span><Dropdown.ItemIndicator /></Dropdown.Item>
          <Dropdown.Separator />
          <Dropdown.Section title="Danger zone">
            <Dropdown.Item id="delete" variant="danger" textValue="Delete"><span data-slot="label">Delete</span><span data-slot="description">Cannot be undone</span></Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>, root));
  const q = (s: string) => document.querySelector(s) as HTMLElement | null;
  const trigger = q('[aria-haspopup="menu"]')!;
  const item = (id: string) => q(`[data-key="${id}"]`)!;
  return { q, trigger, item, onAction, onSelectionChange };
}

describe('<Dropdown> trigger haspopup', () => {
  const triggerOf = (haspopup?: 'menu' | 'dialog') => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    act(() => render(
      <Dropdown>
        <Dropdown.Trigger haspopup={haspopup}><Button label="Fill">c</Button></Dropdown.Trigger>
        <Dropdown.Popover><div /></Dropdown.Popover>
      </Dropdown>, root));
    return root.querySelector('button')!;
  };
  it('announces a menu by default, and a dialog when what it opens is not a menu (a picker)', () => {
    expect(triggerOf().getAttribute('aria-haspopup')).toBe('menu');
    expect(triggerOf('menu').getAttribute('aria-haspopup')).toBe('menu');
    expect(triggerOf('dialog').getAttribute('aria-haspopup')).toBe('dialog');
  });
});

describe('<Dropdown> trigger', () => {
  it('is the child it wraps, marked as opening a menu, closed at first', () => {
    const { q, trigger } = mount();
    expect(trigger.getAttribute('aria-label')).toBe('Actions');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(q('[role="menu"]')).toBeNull();
  });

  it('a press opens the menu with focus on the menu itself, labelled by the trigger', () => {
    const { q, trigger } = mount();
    act(() => trigger.click());
    const menu = q('[role="menu"]')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(menu.getAttribute('aria-labelledby')).toBe(trigger.id);
    expect(document.activeElement).toBe(menu);
  });

  it('ArrowDown opens it on the first item; ArrowUp on the last', () => {
    const a = mount();
    key(a.trigger, 'ArrowDown');
    expect(document.activeElement).toBe(a.item('copy'));
    document.body.replaceChildren();
    const b = mount();
    key(b.trigger, 'ArrowUp');
    expect(document.activeElement).toBe(b.item('delete'));
  });

  it('is controllable', () => {
    const onOpenChange = vi.fn();
    const { q, trigger } = mount({}, { isOpen: false, onOpenChange });
    act(() => trigger.click());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(q('[role="menu"]')).toBeNull();
  });
});

describe('<Dropdown.Menu> keyboard', () => {
  it('arrows move focus, skipping disabled items, stopping at the ends', () => {
    const { trigger, item } = mount();
    key(trigger, 'ArrowDown');
    key(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(item('paste'));
    key(document.activeElement!, 'ArrowDown');
    key(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(item('delete'));
  });

  it('wraps when shouldFocusWrap is set', () => {
    const { trigger, item } = mount({ shouldFocusWrap: true });
    key(trigger, 'ArrowUp');
    key(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(item('copy'));
  });

  it('Home and End jump to the ends', () => {
    const { trigger, item } = mount();
    key(trigger, 'ArrowDown');
    key(document.activeElement!, 'End');
    expect(document.activeElement).toBe(item('delete'));
    key(document.activeElement!, 'Home');
    expect(document.activeElement).toBe(item('copy'));
  });

  it('typing jumps to the item whose text starts with it', () => {
    const { trigger, item } = mount();
    key(trigger, 'ArrowDown');
    key(document.activeElement!, 'd');
    expect(document.activeElement).toBe(item('delete'));
    key(document.activeElement!, 'p');
    expect(document.activeElement).toBe(item('delete'));
  });

  it('Enter acts on the focused item and closes the menu, returning focus to the trigger', () => {
    const { q, trigger, onAction } = mount();
    key(trigger, 'ArrowDown');
    key(document.activeElement!, 'Enter');
    expect(onAction).toHaveBeenCalledWith('copy');
    expect(q('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Tab closes the menu', () => {
    const { q, trigger } = mount();
    key(trigger, 'ArrowDown');
    key(document.activeElement!, 'Tab');
    expect(q('[role="menu"]')).toBeNull();
  });

  it('Escape closes the menu', () => {
    const { q, trigger } = mount();
    key(trigger, 'ArrowDown');
    key(document.activeElement!, 'Escape');
    expect(q('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('<Dropdown.Item>', () => {
  it('a click acts and closes; a disabled item does neither', () => {
    const { q, trigger, item, onAction } = mount();
    act(() => trigger.click());
    act(() => item('cut').click());
    expect(onAction).not.toHaveBeenCalled();
    expect(q('[role="menu"]')).not.toBeNull();
    act(() => item('paste').click());
    expect(onAction).toHaveBeenCalledWith('paste');
    expect(q('[role="menu"]')).toBeNull();
  });

  it('the pointer moving over an item focuses it, as React Aria does', () => {
    const { trigger, item } = mount();
    act(() => trigger.click());
    act(() => { item('paste').dispatchEvent(new MouseEvent('pointermove', { bubbles: true })); });
    expect(document.activeElement).toBe(item('paste'));
    act(() => { item('cut').dispatchEvent(new MouseEvent('pointermove', { bubbles: true })); });
    expect(document.activeElement).toBe(item('paste'));
  });

  it('carries its slots, variant and disabled state', () => {
    const { trigger, item } = mount();
    act(() => trigger.click());
    expect(item('delete').dataset.variant).toBe('danger');
    expect(item('delete').querySelector('[data-slot="description"]')!.textContent).toBe('Cannot be undone');
    expect(item('cut').getAttribute('aria-disabled')).toBe('true');
    expect(item('copy').getAttribute('role')).toBe('menuitem');
  });

  it('a section is a labelled group; a separator is a separator', () => {
    const { q, trigger } = mount();
    act(() => trigger.click());
    const group = q('[role="group"]')!;
    expect(document.getElementById(group.getAttribute('aria-labelledby')!)!.textContent).toBe('Danger zone');
    expect(q('[role="separator"]')).not.toBeNull();
  });
});

describe('<Dropdown.Menu> selection', () => {
  it('single: picks one, marks it checked with an indicator, and closes', () => {
    const { q, trigger, item, onSelectionChange } = mount({ selectionMode: 'single', defaultSelectedKeys: ['copy'] });
    act(() => trigger.click());
    expect(item('copy').getAttribute('role')).toBe('menuitemradio');
    expect(item('copy').getAttribute('aria-checked')).toBe('true');
    expect(item('copy').querySelector('[data-slot="indicator"] svg')).not.toBeNull();
    expect(item('paste').querySelector('[data-slot="indicator"] svg')).toBeNull();
    act(() => item('paste').click());
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['paste']));
    expect(q('[role="menu"]')).toBeNull();
    act(() => trigger.click());
    expect(item('paste').getAttribute('aria-checked')).toBe('true');
    expect(item('copy').getAttribute('aria-checked')).toBe('false');
  });

  it('single: pressing the selected item clears it, unless disallowEmptySelection', () => {
    const a = mount({ selectionMode: 'single', defaultSelectedKeys: ['copy'] });
    act(() => a.trigger.click());
    act(() => a.item('copy').click());
    expect(a.onSelectionChange).toHaveBeenLastCalledWith(new Set());
    document.body.replaceChildren();
    const b = mount({ selectionMode: 'single', defaultSelectedKeys: ['copy'], disallowEmptySelection: true });
    act(() => b.trigger.click());
    act(() => b.item('copy').click());
    expect(b.onSelectionChange).not.toHaveBeenCalled();
  });

  it('multiple: toggles, and stays open', () => {
    const { q, trigger, item, onSelectionChange } = mount({ selectionMode: 'multiple' });
    act(() => trigger.click());
    expect(item('copy').getAttribute('role')).toBe('menuitemcheckbox');
    act(() => item('copy').click());
    act(() => item('paste').click());
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(['copy', 'paste']));
    act(() => item('copy').click());
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(['paste']));
    expect(q('[role="menu"]')).not.toBeNull();
  });

  it('controlled selectedKeys win over clicks until the owner updates them', () => {
    const { trigger, item, onSelectionChange } = mount({ selectionMode: 'single', selectedKeys: ['copy'] });
    act(() => trigger.click());
    act(() => item('paste').click());
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['paste']));
    act(() => trigger.click());
    expect(item('copy').getAttribute('aria-checked')).toBe('true');
  });

  it('disabledKeys disables items by key', () => {
    const { trigger, item, onAction } = mount({ disabledKeys: ['paste'] });
    act(() => trigger.click());
    expect(item('paste').getAttribute('aria-disabled')).toBe('true');
    act(() => item('paste').click());
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe('<Menu> in place, outside a Dropdown', () => {
  function inline(over: Record<string, unknown> = {}) {
    const onSelectionChange = vi.fn();
    const r = document.createElement('div');
    document.body.append(r);
    act(() => render(
      <>
        <button id="before">before</button>
        <Menu aria-label="Blend" selectionMode="single" disallowEmptySelection selectedKeys={['screen']} onSelectionChange={onSelectionChange} {...over}>
          {['normal', 'screen', 'overlay'].map((id) => (
            <Menu.Item key={id} id={id}><span data-slot="label">{id}</span><Menu.ItemIndicator /></Menu.Item>
          ))}
        </Menu>
        <button id="after">after</button>
      </>,
      r,
    ));
    const items = () => [...r.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
    return { r, items, onSelectionChange };
  }

  it('renders where it is: a labelled menu of choices, the selected one checked, taking no focus on its own', () => {
    const { r, items } = inline();
    const menu = r.querySelector('[role="menu"]')!;
    expect(menu.getAttribute('aria-label')).toBe('Blend');
    expect(items().map((i) => i.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(document.activeElement).toBe(document.body);
  });

  it('keeps the name its caller gives it: aria-labelledby to a heading of its own', () => {
    const { r } = inline({ 'aria-label': undefined, 'aria-labelledby': 'blend-heading' });
    expect(r.querySelector('[role="menu"]')!.getAttribute('aria-labelledby')).toBe('blend-heading');
  });

  it('is one tab stop: the selected item, and it follows focus', () => {
    const { items } = inline();
    expect(items().map((i) => i.tabIndex)).toEqual([-1, 0, -1]);
    act(() => { items()[1].focus(); items()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    expect(document.activeElement).toBe(items()[2]);
    expect(items().map((i) => i.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('a click or Enter selects, and nothing closes; Tab is left to the page', () => {
    const { items, onSelectionChange } = inline();
    act(() => items()[2].click());
    expect([...onSelectionChange.mock.calls[0][0]]).toEqual(['overlay']);
    expect(items()).toHaveLength(3);
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => { items()[1].focus(); items()[1].dispatchEvent(tab); });
    expect(tab.defaultPrevented).toBe(false);
  });
});
