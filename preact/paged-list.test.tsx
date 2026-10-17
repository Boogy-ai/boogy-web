import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { PagedListEnd, ConfirmAction, usePagedList } from './index';

const mount = (el: preact.JSX.Element) => { const r = document.createElement('div'); document.body.append(r); act(() => render(el, r)); return r; };
afterEach(() => { document.body.innerHTML = ''; });
const flush = () => act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); });

describe('<PagedListEnd>', () => {
  it('a "Load more" button while there is more, and nothing once the list is done', () => {
    const onMore = vi.fn();
    const r = mount(<PagedListEnd loading={false} done={false} onMore={onMore} />);
    const end = r.querySelector('[data-boogy="paged-list-end"]')!;
    const more = end.querySelector('button')!;
    expect(more.textContent).toBe('Load more');
    act(() => more.click());
    expect(onMore).toHaveBeenCalled();
    expect(mount(<PagedListEnd loading={false} done onMore={onMore} />).querySelector('[data-boogy="paged-list-end"]')).toBeNull();
  });
  it('says it is loading, and does not ask for more meanwhile', () => {
    const onMore = vi.fn();
    const more = mount(<PagedListEnd loading done={false} onMore={onMore} />).querySelector('button')!;
    expect(more.disabled).toBe(true);
  });
});

describe('usePagedList', () => {
  it('loads the first page on its own, and the next on loadMore', async () => {
    const fetchPage = vi.fn(async (c: string | null) => (c ? { items: [3], next_cursor: null } : { items: [1, 2], next_cursor: 'n' }));
    let api: ReturnType<typeof usePagedList<number>> | null = null;
    function Probe() { api = usePagedList(fetchPage, []); return null; }
    mount(<Probe />);
    await flush();
    expect(api!.items).toEqual([1, 2]);
    await act(async () => { await api!.loadMore(); });
    expect(api!.items).toEqual([1, 2, 3]);
    expect(api!.done).toBe(true);
  });
});

describe('<ConfirmAction> as an icon', () => {
  it('shows only its glyph, named by its label, until it asks', () => {
    const r = mount(<ConfirmAction label="Delete" glyph="trash" iconOnly question="Delete this?" onConfirm={() => {}} />);
    const b = r.querySelector('button')!;
    expect(b.getAttribute('aria-label')).toBe('Delete');
    expect(b.textContent).toBe('');
    expect(b.getAttribute('data-shape')).toBe('icon');
  });
});

describe('<ConfirmAction>', () => {
  it('asks once, in place; confirming runs the action, cancelling or Escape steps back', async () => {
    const onConfirm = vi.fn();
    const r = mount(<ConfirmAction label="Delete" question="Delete this?" onConfirm={onConfirm} />);
    const first = r.querySelector('button')!;
    expect(first.textContent).toBe('Delete');
    act(() => first.click());
    const box = r.querySelector('[data-boogy="confirm-action"]')!;
    expect(box.hasAttribute('data-asking')).toBe(true);
    expect(box.querySelector('[data-slot="question"]')!.textContent).toBe('Delete this?');
    const [yes, no] = [...box.querySelectorAll('button')];
    expect(document.activeElement).toBe(yes);
    act(() => no.click());
    expect(r.querySelector('[data-boogy="confirm-action"]')!.hasAttribute('data-asking')).toBe(false);
    act(() => r.querySelector('button')!.click());
    act(() => { r.querySelector('[data-boogy="confirm-action"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(r.querySelector('[data-boogy="confirm-action"]')!.hasAttribute('data-asking')).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => r.querySelector('button')!.click());
    await act(async () => { r.querySelector<HTMLButtonElement>('[data-boogy="confirm-action"] button')!.click(); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('its answers are the SDK\'s Delete and Cancel: their looks and words from the one table', () => {
    const r = mount(<ConfirmAction label="Remove" question="Remove them?" onConfirm={() => {}} />);
    act(() => r.querySelector('button')!.click());
    const [yes, no] = [...r.querySelectorAll<HTMLButtonElement>('[data-boogy="confirm-action"] button')];
    expect(yes.dataset.action).toBe('delete');
    expect(yes.dataset.variant).toBe('danger');
    expect(yes.textContent).toBe('Remove');
    expect(no.dataset.action).toBe('cancel');
    expect(no.dataset.variant).toBe('quiet');
    expect(no.textContent).toBe('Cancel');
  });
});

describe('a list item that is unread, and the lock glyph', async () => {
  const { ListItem, List, Glyph } = await import('./index');
  const { ruleFor } = await import('../test-support/rule-for');
  it('an unread item is marked, its title bolder, with a dot and words a screen reader hears', () => {
    const r = mount(<List><ListItem title="general" unread meta="12:01" /><ListItem title="dinner" /></List>);
    const [a, b] = [...r.querySelectorAll('[data-boogy="list-item"]')];
    expect(a.hasAttribute('data-unread')).toBe(true);
    expect(a.querySelector('[data-slot="unread"]')!.getAttribute('aria-hidden')).toBe('true');
    expect(a.querySelector('[data-visually-hidden]')!.textContent).toBe(' (unread)');
    expect(b.hasAttribute('data-unread')).toBe(false);
    expect(b.querySelector('[data-slot="unread"]')).toBeNull();
    expect(ruleFor('[data-boogy="list-item"][data-unread] [data-slot="title"]')).toMatch(/font-weight:\s*600/);
    expect(ruleFor('[data-boogy="list-item"] [data-slot="unread"]')).toMatch(/background:\s*var\(--accent\)/);
  });
  it('draws a lock', () => {
    const svg = mount(<Glyph shape="lock" />).querySelector('svg')!;
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
  });
});

describe('the trash and info glyphs', async () => {
  const { Glyph } = await import('./index');
  it('draws each', () => {
    for (const shape of ['trash', 'info'] as const) {
      expect(mount(<Glyph shape={shape} />).querySelectorAll('svg path').length, shape).toBeGreaterThan(0);
    }
  });
});

describe('<PagedListEnd> after a failed read', () => {
  it('asks again only when pressed: no reading by itself while it failed, and it says so', () => {
    const onMore = vi.fn();
    const root = document.createElement('div');
    document.body.appendChild(root);
    act(() => render(<PagedListEnd loading={false} done={false} error={new Error('offline')} onMore={onMore} />, root));
    expect(onMore).not.toHaveBeenCalled();
    const button = root.querySelector('button')!;
    expect(button.textContent).toBe('Try again');
    act(() => button.click());
    expect(onMore).toHaveBeenCalledTimes(1);
  });
});
