import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { DrawerLayout, Drawer, DrawerMain, DrawerToggle, List, ListItem, useDrawerHandle, type DrawerHandle } from './index';
import { COMPONENTS_CSS } from '../src/components/components-css';

afterEach(() => { document.body.replaceChildren(); });
function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return root;
}

describe('a compact list, and the item that is open', () => {
  it('a compact list says so; the open item is the current one, for everyone', () => {
    const root = mount(
      <List density="compact" aria-label="Rooms">
        <ListItem as="a" href="/r/general" title="General" unread />
        <ListItem as="a" href="/r/design" title="Design" current />
      </List>,
    );
    expect(root.querySelector('ul')!.getAttribute('data-density')).toBe('compact');
    const [general, design] = [...root.querySelectorAll('a')];
    expect(general.hasAttribute('aria-current')).toBe(false);
    expect(design.getAttribute('aria-current')).toBe('page');
  });

  it("has rules for both, and for unread and open items on a folded drawer's rail", () => {
    expect(COMPONENTS_CSS).toContain('[data-boogy="list"][data-density="compact"]');
    expect(COMPONENTS_CSS).toMatch(/\[data-boogy="list-item"\]\[aria-current="page"\]/);
    expect(COMPONENTS_CSS).toContain('[data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list-item"][data-unread]::before');
  });
});

describe('a drawer toggle with something new behind it', () => {
  it('shows a dot, and says so to a screen reader', () => {
    const root = mount(
      <DrawerLayout side="start">
        <Drawer label="Rooms"><List><ListItem title="General" /></List></Drawer>
        <DrawerMain><DrawerToggle label={{ show: 'Show rooms', hide: 'Hide rooms' }} unread /></DrawerMain>
      </DrawerLayout>,
    );
    const toggle = root.querySelector<HTMLButtonElement>('[data-role="drawer-toggle"]')!;
    expect(toggle.querySelector('[data-slot="unread"]')).not.toBeNull();
    expect(toggle.getAttribute('aria-label')).toMatch(/new/i);
  });
});

describe('a toggle for a drawer it is not inside', () => {
  it("a handle taken under one layout drives that layout's drawer from inside another", () => {
    const Inner = ({ rooms }: { rooms: DrawerHandle }) => {
      const [open, setOpen] = useState(false);
      return (
        <DrawerLayout side="end" open={open} onOpenChange={setOpen}>
          <Drawer label="Members"><List><ListItem title="theo" /></List></Drawer>
          <DrawerMain><DrawerToggle id="RT" drawer={rooms} label={{ show: 'Show rooms', hide: 'Hide rooms' }} /></DrawerMain>
        </DrawerLayout>
      );
    };
    const Take = () => <Inner rooms={useDrawerHandle()} />;
    const Screen = () => {
      const [open, setOpen] = useState(false);
      return (
        <DrawerLayout side="start" open={open} onOpenChange={setOpen}>
          <Drawer label="Rooms"><List><ListItem title="General" /></List></Drawer>
          <DrawerMain><Take /></DrawerMain>
        </DrawerLayout>
      );
    };
    const root = mount(<Screen />);
    const toggle = root.querySelector<HTMLButtonElement>('#RT')!;
    expect(toggle.getAttribute('aria-label')).toMatch(/rooms/);
    const outer = root.querySelector('[data-boogy="drawer-layout"]')!;
    const inner = outer.querySelector('[data-boogy="drawer-main"] [data-boogy="drawer-layout"]')!;
    act(() => toggle.click());
    // No stylesheet in a test, so both drawers are overlays: the rooms
    // layout opens, the members one does not.
    expect(outer.getAttribute('data-open')).toBe('true');
    expect(inner.getAttribute('data-open')).toBe('false');
  });
});
