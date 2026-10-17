import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, type JSX } from 'preact';
import { act } from 'preact/test-utils';
import { Section, Notice, InfoList, DetailHeader, SearchField, List, ListItem, Avatar, Thumbnail } from './index';
import { COMPONENTS_CSS_PARTS } from '../src/components/components-css';

afterEach(() => { document.body.innerHTML = ''; });
const mount = (el: JSX.Element) => { const r = document.createElement('div'); document.body.append(r); act(() => render(el, r)); return r; };

describe('<Section>', () => {
  it('can say what the group is, in a line under its heading', () => {
    const r = mount(<Section title="Your apps" description="Apps you have published."><p /></Section>);
    expect(r.querySelector('[data-slot="description"]')!.textContent).toBe('Apps you have published.');
    // In the head, under the heading: the two read as one caption, spaced by
    // the head's own gap rather than the section's.
    const description = r.querySelector('[data-boogy="section"] > [data-slot="head"] > [data-slot="description"]');
    expect(description).not.toBeNull();
    expect(description!.previousElementSibling!.getAttribute('data-slot')).toBe('header');
    expect(COMPONENTS_CSS_PARTS.SECTION_CSS).toMatch(/\[data-slot="head"\] > \[data-slot="description"\] \{[^}]*color:\s*var\(--text-3\)/);
  });
  it('spans the head under both the heading and its action', () => {
    const r = mount(<Section title="Yours" description="Apps you have published." action={<button id="all">All</button>}><p /></Section>);
    const kids = [...r.querySelector('[data-slot="head"]')!.children].map((c) => c.getAttribute('data-slot') ?? c.id);
    expect(kids).toEqual(['header', 'all', 'description']);
    expect(COMPONENTS_CSS_PARTS.SECTION_CSS).toMatch(/\[data-slot="head"\] > \[data-slot="description"\] \{[^}]*grid-column:\s*1 \/ -1/);
  });
  it('trims the caption lines to their letters, so the space between them is a token and not leading', () => {
    const css = COMPONENTS_CSS_PARTS.SECTION_CSS;
    expect(css).toMatch(/\[data-slot="header"\] \{[^}]*text-box:\s*trim-both cap alphabetic/);
    expect(css).toMatch(/\[data-slot="head"\] > \[data-slot="description"\] \{[^}]*text-box:\s*trim-both cap alphabetic/);
  });
  it('has no description line when given none', () => {
    const r = mount(<Section title="Yours"><p /></Section>);
    expect(r.querySelector('[data-slot="description"]')).toBeNull();
  });
  it('a short value may go with its title, as "title · meta", read as one heading', () => {
    const r = mount(<Section title="Members" meta={3}><p /></Section>);
    const header = r.querySelector('[data-slot="header"]')!;
    expect(header.textContent).toBe('Members · 3');
    expect(header.querySelector('[data-slot="title"]')!.textContent).toBe('Members');
    expect(header.querySelector('[data-slot="meta"]')!.textContent).toBe(' · 3');
    expect(header.querySelector('[data-slot="separator"]')!.getAttribute('aria-hidden')).toBe('true');
    expect(mount(<Section title="Yours"><p /></Section>).querySelector('[data-slot="meta"]')).toBeNull();
  });
  it('a glyph rides in the header, shown only where the heading has no room for its title', () => {
    const r = mount(<Section title="Members" glyph="users"><p /></Section>);
    const glyph = r.querySelector('[data-slot="header"] > [data-slot="glyph"]')!;
    expect(glyph.getAttribute('data-boogy')).toBe('glyph');
    expect(glyph.getAttribute('aria-hidden')).toBe('true');
    expect(COMPONENTS_CSS_PARTS.SECTION_CSS).toMatch(/\[data-boogy="section"\] \[data-slot="header"\] > \[data-slot="glyph"\] \{ display: none; \}/);
  });
  it('captions a group, with an optional action', () => {
    const r = mount(<Section title="Yours" action={<button id="all">See all</button>}><p id="kid" /></Section>);
    expect(r.querySelector('[data-boogy="section"] [data-slot="header"]')!.textContent).toBe('Yours');
    expect(r.querySelector('[data-slot="head"] #all')).not.toBeNull();
    expect(r.querySelector('#kid')).not.toBeNull();
  });
});

describe('<Notice> with an action', () => {
  it('its one action sits at the end of its line; a notice without one is plain text', () => {
    const r = mount(<Notice action={<button id="undo">Unarchive</button>}>Archived.</Notice>);
    expect(r.querySelector('[data-boogy="notice"] > [data-slot="action"] > #undo')).not.toBeNull();
    expect(mount(<Notice>Plain.</Notice>).querySelector('[data-slot="action"]')).toBeNull();
    expect(COMPONENTS_CSS_PARTS.NOTICE_CSS).toMatch(/\[data-boogy="notice"\]:has\(> \[data-slot="action"\]\) \{[^}]*display:\s*flex[^}]*justify-content:\s*space-between/);
  });
});

describe('<InfoList>', () => {
  it('drops empty values and opens links outside', () => {
    const r = mount(<InfoList items={[
      { label: 'Version', value: '1.2.0' },
      { label: 'License', value: undefined },
      { label: 'Source', value: 'github.com/x', href: 'https://github.com/x' },
    ]} />);
    expect([...r.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Version', 'Source']);
    const a = r.querySelector('dd a')!;
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noreferrer');
  });
  it('renders nothing when every value is empty', () => {
    const r = mount(<InfoList items={[{ label: 'License', value: '' }]} />);
    expect(r.querySelector('[data-boogy="info-list"]')).toBeNull();
  });
});

describe('<DetailHeader> and <Notice>', () => {
  it('lays out media, title, meta and actions', () => {
    const r = mount(<DetailHeader media={<i id="m" />} title="Squad Chats" meta="tester" actions={<button id="go" />} />);
    const d = r.querySelector('[data-boogy="detail-header"]')!;
    expect(d.querySelector('[data-slot="title"]')!.textContent).toBe('Squad Chats');
    expect(d.querySelector('[data-slot="actions"] #go')).not.toBeNull();
  });
  it('a notice carries its tone', () => {
    const r = mount(<Notice tone="warning">Could not load.</Notice>);
    expect(r.querySelector('[data-boogy="notice"]')!.getAttribute('data-tone')).toBe('warning');
  });
});

describe('<SearchField>', () => {
  it('is a labelled search input whose clear button appears only with text', () => {
    const r = mount(<SearchField label="Search apps" value="" onValueChange={vi.fn()} />);
    const input = r.querySelector('input')!;
    expect(input.getAttribute('type')).toBe('search');
    expect(input.getAttribute('aria-label')).toBe('Search apps');
    expect(r.querySelector('[data-slot="suffix"] button')).toBeNull();
  });
  it('clear empties it and returns focus to the input', () => {
    const onValueChange = vi.fn();
    const r = mount(<SearchField label="Search" value="chat" onValueChange={onValueChange} />);
    act(() => { (r.querySelector('[data-slot="suffix"] button') as HTMLButtonElement).click(); });
    expect(onValueChange).toHaveBeenCalledWith('');
    expect(document.activeElement).toBe(r.querySelector('input'));
  });
  it('Escape clears a non-empty field without reaching its container; an empty one lets it through', () => {
    const onValueChange = vi.fn();
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    const r = mount(<SearchField label="Search" value="chat" onValueChange={onValueChange} />);
    act(() => { r.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(onValueChange).toHaveBeenCalledWith('');
    expect(outer).not.toHaveBeenCalled();
    const r2 = mount(<SearchField label="Search" value="" onValueChange={onValueChange} />);
    act(() => { r2.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(outer).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', outer);
  });
  it('its glass sits in an icon slot, not the text prefix, and is hidden from assistive tech', () => {
    const r = mount(<SearchField label="Search" value="" onValueChange={vi.fn()} />);
    const icon = r.querySelector('[data-slot="group"] > [data-slot="icon"]');
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute('aria-hidden')).toBe('true');
    expect(r.querySelector('[data-slot="prefix"]')).toBeNull();
  });
  it('can be fully rounded, and its clear button rounds with it', () => {
    const r = mount(<SearchField label="Search" value="chat" rounded onValueChange={vi.fn()} />);
    expect(r.querySelector('[data-boogy="field"]')!.getAttribute('data-rounded')).toBe('true');
    expect(r.querySelector('[data-slot="suffix"] button')!.getAttribute('data-rounded')).toBe('true');
    const square = mount(<SearchField label="Search" value="chat" onValueChange={vi.fn()} />);
    expect(square.querySelector('[data-boogy="field"]')!.hasAttribute('data-rounded')).toBe(false);
  });
  it('hands a paste to its container, which may take it over', () => {
    const onPaste = vi.fn((e: ClipboardEvent) => e.preventDefault());
    const r = mount(<SearchField label="Search" value="" onValueChange={vi.fn()} onPaste={onPaste} />);
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    act(() => { r.querySelector('input')!.dispatchEvent(paste); });
    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(paste.defaultPrevented).toBe(true);
  });
});

// The Preact markup and the stylesheet must agree: a selector nothing renders
// is a rule that silently styles nothing.
const selectorsIn = (css: string) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}@]+)\{/g)].flatMap((m) => m[1].split(',').map((s) => s.trim()));

describe('markup meets its stylesheet', () => {
  it("every rule a drawer's strip has for a section or a list matches the markup they render", () => {
    const r = mount(
      <div data-boogy="drawer-layout" data-collapse-at="md" data-expanded="false">
        <div data-boogy="drawer">
          <Section title="Members" glyph="users" meta={3} description="Who is here" action={<button>All</button>}>
            <List>
              <ListItem media={<Avatar name="tess" size="sm" />} title="tess" end={<button>x</button>} />
              <ListItem media={<Avatar name="ana" size="sm" />} title="ana" unread />
              <ListItem media={<Avatar name="bo" size="sm" />} title="bo" current />
              <ListItem media={<Thumbnail label="Home" />} title="Home" />
            </List>
          </Section>
          <Section title="Plain"><p /></Section>
        </div>
      </div>,
    );
    // The head-less rule (`:not(:has(> …))`) is left to the browser test
    // (test-browser/drawer.browser.test.ts): this DOM evaluates a complex
    // selector inside `:not(:has())` wrongly, where a browser does not.
    const strip = selectorsIn(COMPONENTS_CSS_PARTS.DRAWER_CSS)
      .filter((s) => s.startsWith('[data-collapse-at="md"][data-expanded="false"]') && /section|list-item/.test(s) && !s.includes(':has('));
    expect(strip.length).toBeGreaterThanOrEqual(8);
    // A pseudo-element is its element's: the element must be in the markup.
    for (const s of strip) expect(r.querySelector(s.replace(/::(before|after)$/, '')), s).not.toBeNull();
  });
  it("a Section's header is styled by a rule that matches it", () => {
    const r = mount(<Section title="Yours" action={<button>All</button>}><p /></Section>);
    const header = r.querySelector('[data-slot="header"]')!;
    const rules = selectorsIn(COMPONENTS_CSS_PARTS.SECTION_CSS).filter((s) => s.endsWith('[data-slot="header"]'));
    expect(rules.some((s) => header.matches(s))).toBe(true);
  });
  it("a DetailHeader's narrow rule styles its children, which a container query can reach", () => {
    const css = COMPONENTS_CSS_PARTS.DETAIL_HEADER_CSS;
    const narrow = css.slice(css.indexOf('@container'));
    const sels = selectorsIn(narrow.slice(narrow.indexOf('{') + 1));
    expect(sels.length).toBeGreaterThan(0);
    for (const s of sels) expect(s).not.toBe('[data-boogy="detail-header"]');
    expect(css).toMatch(/\[data-boogy="detail-header"\] \{[^}]*flex-wrap:\s*wrap/);
  });
  it("the search field hides the browser's own clear button, so there is one", () => {
    expect(COMPONENTS_CSS_PARTS.FIELD_CSS).toMatch(/::-webkit-search-cancel-button\s*\{[^}]*display:\s*none/);
  });
});

describe('<InfoList> links', () => {
  it('only an http(s) address becomes a link; anything else is plain text', () => {
    const r = mount(<InfoList items={[
      { label: 'Website', value: 'example.com', href: 'javascript://example.com/%0Aalert(1)' },
      { label: 'Source', value: 'github.com/x', href: 'https://github.com/x' },
    ]} />);
    const links = [...r.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['https://github.com/x']);
    expect(r.textContent).toContain('example.com');
  });
});

describe('<SearchField> focus', () => {
  it('autoFocus focuses it every time it mounts, not only on the first page load', () => {
    const r = mount(<SearchField label="Search" value="" onValueChange={vi.fn()} autoFocus />);
    expect(document.activeElement).toBe(r.querySelector('input'));
    (document.activeElement as HTMLElement).blur();
    const r2 = mount(<SearchField label="Search" value="" onValueChange={vi.fn()} autoFocus />);
    expect(document.activeElement).toBe(r2.querySelector('input'));
  });
});
