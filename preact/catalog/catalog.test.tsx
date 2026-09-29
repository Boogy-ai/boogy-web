import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { AppIcon, AppTile, AppRow, AppDetail, appSubtitle } from './index';
import type { AppEntry } from '@boogy/web/catalog';

afterEach(() => { document.body.innerHTML = ''; });
const mount = (el: preact.JSX.Element) => { const r = document.createElement('div'); document.body.append(r); act(() => render(el, r)); return r; };

const full: AppEntry = {
  key: 'k', name: 'Squad Chats', publisher: 'tester', category: 'messaging', description: 'A chat.',
  keywords: ['chat', 'messaging'], version: '0.1.23', license: 'MIT',
  links: { source: 'https://github.com/x/squad', website: 'https://squad.example', docs: undefined }, action: 'open',
};
const bare: AppEntry = { key: 'b', name: 'Polls', publisher: 'tester', keywords: [], links: {}, action: 'install' };

describe('appSubtitle', () => {
  it('joins the parts it has and nothing else', () => {
    expect(appSubtitle(full)).toBe('tester · messaging');
    expect(appSubtitle(bare)).toBe('tester');
    expect(appSubtitle({ ...bare, instance: 'polls-2' })).toBe('tester · polls-2');
  });
});

describe('<AppIcon>', () => {
  it('is a thumbnail of the app, placeholder without an icon, hidden beside the name', () => {
    const r = mount(<AppIcon entry={full} size="lg" />);
    const t = r.querySelector('[data-boogy="thumbnail"]')!;
    expect(t.getAttribute('aria-hidden')).toBe('true');
    expect(t.textContent).toBe('SC');
  });
});

describe('<AppTile>', () => {
  it('is one button selecting the entry', () => {
    const onSelect = vi.fn();
    const r = mount(<ul><AppTile entry={full} onSelect={onSelect} /></ul>);
    const b = r.querySelector('button[data-boogy="tile"]') as HTMLButtonElement;
    expect(b.querySelector('[data-slot="title"]')!.textContent).toBe('Squad Chats');
    b.click();
    expect(onSelect).toHaveBeenCalledWith(full);
  });
});

describe('<AppRow>', () => {
  it('the row opens the detail, the button acts — and the two never both fire', () => {
    const onSelect = vi.fn();
    const onAction = vi.fn();
    const r = mount(<ul><AppRow entry={bare} onSelect={onSelect} onAction={onAction} /></ul>);
    const act1 = r.querySelector('[data-slot="end"] button') as HTMLButtonElement;
    expect(act1.textContent).toBe('Install');
    act1.click();
    expect(onAction).toHaveBeenCalledWith(bare);
    expect(onSelect).not.toHaveBeenCalled();
    (r.querySelector('[data-slot="title"] > button') as HTMLButtonElement).click();
    expect(onSelect).toHaveBeenCalledWith(bare);
  });
  it('a bare entry has no stray separator and no description line', () => {
    const r = mount(<ul><AppRow entry={bare} onSelect={() => {}} onAction={() => {}} /></ul>);
    expect(r.querySelector('[data-slot="subtitle"]')!.textContent).toBe('tester');
    expect(r.querySelector('[data-slot="description"]')).toBeNull();
    expect(r.textContent).not.toMatch(/undefined|·\s*$/);
  });
  it('shows busy and a note', () => {
    const r = mount(<ul><AppRow entry={bare} busy note="The install was cancelled." onSelect={() => {}} onAction={() => {}} /></ul>);
    expect((r.querySelector('[data-slot="end"] button') as HTMLButtonElement).disabled).toBe(true);
    expect(r.textContent).toContain('The install was cancelled.');
  });
});

describe('<AppDetail>', () => {
  it('shows the header, description, information and keywords', () => {
    const onAction = vi.fn();
    const r = mount(<AppDetail entry={full} onAction={onAction} actionLabel="Open in this pane" />);
    expect(r.querySelector('[data-boogy="detail-header"] [data-slot="title"]')!.textContent).toBe('Squad Chats');
    expect(r.querySelector('[data-slot="meta"]')!.textContent).toBe('tester · messaging · v0.1.23');
    expect(r.textContent).toContain('A chat.');
    expect([...r.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Version', 'License', 'Source', 'Website']);
    expect([...r.querySelectorAll('[data-boogy="pill"]')].map((p) => p.textContent)).toEqual(['chat', 'messaging']);
    (r.querySelector('[data-slot="actions"] button') as HTMLButtonElement).click();
    expect(onAction).toHaveBeenCalledWith(full);
  });
  it('autoFocus puts focus on its action, so a view change never drops it to the page', () => {
    const r = mount(<AppDetail entry={bare} onAction={() => {}} autoFocus />);
    expect(document.activeElement).toBe(r.querySelector('[data-slot="actions"] button'));
  });
  it('is laid out by the stylesheet, not by inline styles', () => {
    const r = mount(<AppDetail entry={{ ...full, description: 'One.\n\nTwo.' }} onAction={() => {}} note="Installed as squad-2." />);
    expect(r.querySelectorAll('[style]').length).toBe(0);
    expect([...r.querySelectorAll('article p:not([data-boogy])')].map((p) => p.textContent)).toEqual(['One.', 'Two.']);
    expect(r.querySelector('[data-boogy="notice"]')!.textContent).toBe('Installed as squad-2.');
  });
  it('a bare entry drops the Information section, the keywords and the description', () => {
    const r = mount(<AppDetail entry={bare} onAction={() => {}} />);
    expect(r.querySelector('[data-boogy="info-list"]')).toBeNull();
    expect(r.querySelector('[data-boogy="pill"]')).toBeNull();
    expect(r.querySelector('[data-slot="meta"]')!.textContent).toBe('tester');
    expect(r.querySelector('[data-slot="actions"] button')!.textContent).toBe('Install');
  });
});

describe('an app icon beside its name', () => {
  it('is decorative in a tile, a row and a detail page, so the name is read once', () => {
    const r = mount(<div>
      <ul><AppTile entry={full} onSelect={() => {}} /></ul>
      <ul><AppRow entry={full} onSelect={() => {}} onAction={() => {}} /></ul>
      <AppDetail entry={full} onAction={() => {}} />
    </div>);
    const icons = [...r.querySelectorAll('[data-boogy="thumbnail"]')];
    expect(icons.length).toBe(3);
    for (const i of icons) expect(i.getAttribute('aria-hidden')).toBe('true');
  });
});
