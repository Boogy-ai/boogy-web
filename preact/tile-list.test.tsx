import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, type JSX } from 'preact';
import { act } from 'preact/test-utils';
import { Tile, TileGrid, List, ListItem } from './index';

afterEach(() => { document.body.innerHTML = ''; });
const mount = (el: JSX.Element) => { const r = document.createElement('div'); document.body.append(r); act(() => render(el, r)); return r; };

describe('<Tile>/<TileGrid>', () => {
  it('a tile is one control inside a grid item, with its slots', () => {
    const onClick = vi.fn();
    const r = mount(<TileGrid><Tile as="button" media={<i id="m" />} title="Squad Chats" subtitle="tester" onClick={onClick} /></TileGrid>);
    const t = r.querySelector('ul[data-boogy="tile-grid"] > li > button[data-boogy="tile"]') as HTMLButtonElement;
    expect(t.getAttribute('type')).toBe('button');
    expect(t.querySelector('[data-slot="media"] #m')).not.toBeNull();
    expect(t.querySelector('[data-slot="title"]')!.textContent).toBe('Squad Chats');
    expect(t.querySelector('[data-slot="subtitle"]')!.textContent).toBe('tester');
    t.click();
    expect(onClick).toHaveBeenCalled();
  });
  it('leaves out an absent subtitle', () => {
    const r = mount(<TileGrid><Tile title="Boards" /></TileGrid>);
    expect(r.querySelector('[data-slot="subtitle"]')).toBeNull();
  });
});

describe('<ListItem> meta', () => {
  it('trailing info on the title\'s line — allowed on a row that is itself a control', () => {
    const r = mount(<List><ListItem as="button" title="carol" subtitle="see you at 6" meta="14:02" /></List>);
    const text = r.querySelector('[data-boogy="list-item"] > [data-slot="text"]')!;
    const heading = text.querySelector(':scope > [data-slot="heading"]')!;
    expect([...heading.children].map((c) => c.getAttribute('data-slot'))).toEqual(['title', 'meta']);
    expect(heading.querySelector('[data-slot="meta"]')!.textContent).toBe('14:02');
    expect(text.querySelector(':scope > [data-slot="subtitle"]')!.textContent).toBe('see you at 6');
  });
  it('without meta, the title stays a direct child of the text', () => {
    const r = mount(<List><ListItem title="carol" /></List>);
    expect(r.querySelector('[data-slot="text"] > [data-slot="title"]')).not.toBeNull();
    expect(r.querySelector('[data-slot="heading"]')).toBeNull();
  });
});

describe('<ListItem>', () => {
  it('lays out media, text and an end action', () => {
    const r = mount(<List><ListItem media={<i />} title="Chat EU" subtitle="alice · Messaging" description="A chat." end={<button id="act">Install</button>} /></List>);
    const row = r.querySelector('ul[data-boogy="list"] > li > [data-boogy="list-item"]')!;
    expect(row.tagName).toBe('DIV');
    expect(row.querySelector('[data-slot="text"] [data-slot="title"]')!.textContent).toBe('Chat EU');
    expect(row.querySelector('[data-slot="end"] #act')).not.toBeNull();
  });
  it('as a button, it is one control and refuses an end slot', () => {
    const r = mount(<List><ListItem as="button" title="Squad" /></List>);
    expect(r.querySelector('button[data-boogy="list-item"]')!.getAttribute('type')).toBe('button');
    expect(() => mount(<List><ListItem as="button" title="x" end={<button />} /></List>)).toThrow(/one control/);
  });
});
