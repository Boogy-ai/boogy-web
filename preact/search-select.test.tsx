import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { SearchSelect } from './index';
import { SEARCH_DELAY_MS } from '@boogy/web';

type Room = { slug: string; name: string };
const ROOMS: Room[] = [{ slug: 'general', name: 'general' }, { slug: 'dinner', name: 'Dinner' }, { slug: 'garden', name: 'garden 825' }];

afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); });
beforeEach(() => {
  // The popover API, where the test DOM lacks it.
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  if (!proto.showPopover) { proto.showPopover = function () {}; proto.hidePopover = function () {}; }
});
function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return root;
}
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

function Harness({ load, onChange }: { load: (cursor: string | null, q: string) => Promise<{ items: Room[]; next_cursor?: string | null }>; onChange?: (r: Room) => void }) {
  const [room, setRoom] = useState<Room | null>(ROOMS[0]);
  return (
    <SearchSelect label="Room" value={room} load={load} itemKey={(r) => r.slug} itemLabel={(r) => r.name}
      onChange={(r) => { setRoom(r); onChange?.(r); }} />
  );
}
const loader = () => vi.fn(async (_cursor: string | null, q: string) => ({ items: ROOMS.filter((r) => r.name.toLowerCase().startsWith(q.toLowerCase())), next_cursor: null }));

describe('<SearchSelect>', () => {
  it('a field: its label names a trigger showing the choice, which opens a list; nothing is read before it opens', () => {
    const load = loader();
    const root = mount(<Harness load={load} />);
    const label = root.querySelector('[data-boogy="field"] > [data-slot="label"]') as HTMLLabelElement;
    const trigger = root.querySelector('[data-boogy="field"] > button[data-slot="control"]') as HTMLButtonElement;
    expect(label.textContent).toBe('Room');
    expect(label.htmlFor).toBe(trigger.id);
    expect(trigger.textContent).toContain('general');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(load).not.toHaveBeenCalled();
  });

  it('open: a search that drives the list, the choice marked; picking one closes it', async () => {
    const load = loader();
    const onChange = vi.fn();
    const root = mount(<Harness load={load} onChange={onChange} />);
    const trigger = root.querySelector('button[data-slot="control"]') as HTMLButtonElement;
    act(() => trigger.click());
    await flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(load).toHaveBeenCalledWith(null, '');
    const input = document.querySelector('input[role="combobox"]') as HTMLInputElement;
    const listbox = document.querySelector('[role="listbox"]')!;
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    const options = [...listbox.querySelectorAll('[role="option"]')];
    expect(options.map((o) => o.textContent)).toEqual(['general', 'Dinner', 'garden 825']);
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(options[1].getAttribute('aria-selected')).toBe('false');
    act(() => (options[1] as HTMLElement).click());
    expect(onChange).toHaveBeenCalledWith(ROOMS[1]);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(trigger.textContent).toContain('Dinner');
  });

  it('typing searches, once, a moment after the last key', async () => {
    vi.useFakeTimers();
    const load = loader();
    const root = mount(<Harness load={load} />);
    act(() => (root.querySelector('button[data-slot="control"]') as HTMLButtonElement).click());
    await flush();
    const input = document.querySelector('input[role="combobox"]') as HTMLInputElement;
    for (const text of ['g', 'ga', 'gar']) {
      act(() => { input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); });
    }
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(SEARCH_DELAY_MS); });
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith(null, 'gar');
    expect([...document.querySelectorAll('[role="option"]')].map((o) => o.textContent)).toEqual(['garden 825']);
  });

  it('the arrows move along the list, the search says which, and Enter picks it', async () => {
    const onChange = vi.fn();
    const root = mount(<Harness load={loader()} onChange={onChange} />);
    act(() => (root.querySelector('button[data-slot="control"]') as HTMLButtonElement).click());
    await flush();
    const input = document.querySelector('input[role="combobox"]') as HTMLInputElement;
    const key = (k: string) => act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });
    key('ArrowDown');
    key('ArrowDown');
    const options = [...document.querySelectorAll('[role="option"]')];
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1].id);
    expect(options[1].getAttribute('data-active')).toBe('true');
    key('Enter');
    expect(onChange).toHaveBeenCalledWith(ROOMS[1]);
  });

  it('a list that fails to load says so, rather than showing an empty list', async () => {
    const load = vi.fn(async () => { throw new Error('offline'); });
    const root = mount(<Harness load={load} />);
    act(() => (root.querySelector('button[data-slot="control"]') as HTMLButtonElement).click());
    await flush();
    const alert = document.querySelector('[data-boogy="search-select"] [data-slot="results"] [role="alert"]');
    expect(alert?.textContent).toMatch(/couldn.t load/i);
  });

  it('nothing matching says so', async () => {
    const load = vi.fn(async () => ({ items: [] as Room[], next_cursor: null }));
    const root = mount(<Harness load={load} />);
    act(() => (root.querySelector('button[data-slot="control"]') as HTMLButtonElement).click());
    await flush();
    expect(document.querySelector('[data-boogy="search-select"] > [data-slot="results"] > [data-slot="empty"]')?.textContent).toBe('Nothing matches');
    expect(document.querySelector('[role="listbox"] [data-slot="empty"]')).toBeNull();
  });
});
