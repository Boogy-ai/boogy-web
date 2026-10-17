// A rooms drawer on the start side around a members drawer on the end side,
// each folding to its rail on its own (Discord's shape).
import { render } from 'preact';
import { Avatar, Thumbnail, Drawer, DrawerItem, DrawerLayout, DrawerMain, DrawerToggle, List, ListItem, SearchField, useDrawerHandle, type DrawerHandle } from '../../preact/index';
import { installFoundation } from '@boogy/web';

const ROOMS = [
  { name: 'General', unread: true, current: false },
  { name: 'Design', unread: false, current: true },
  { name: 'Random', unread: false, current: false },
];
const ROOMS_TOGGLE = { show: 'Show rooms', hide: 'Hide rooms' };
const MEMBERS_TOGGLE = { show: 'Show members', hide: 'Hide members' };

function Screen({ rooms, members }: { rooms: boolean; members: boolean }) {
  return (
    // An app gives its outermost layout the page's height (Rooms: `.app`).
    <DrawerLayout side="start" collapseAt="md" expanded={rooms} animate={false} style={{ height: '100%' }}>
      <Drawer
        id="RD" label="Rooms"
        // The drawer's title (a link home) and, beside it, its own toggle.
        head={<><DrawerItem id="RTI" as="a" href="#" variant="title" label="Harbor Lane Studio" mark={<Thumbnail label="Harbor Lane Studio" size="sm" />} /><DrawerToggle id="RHT" shown="expanded" label={ROOMS_TOGGLE} /></>}
        foot={<DrawerToggle id="RT" shown="collapsed" label={ROOMS_TOGGLE} />}
      >
        <List density="compact" variant="nav" aria-label="Rooms">
          {ROOMS.map((r) => (
            <ListItem key={r.name} id={`room-${r.name}`} as="a" href="#" media={<Avatar name={r.name} size="xs" variant="rounded" decorative />} title={r.name} unread={r.unread} current={r.current} />
          ))}
        </List>
      </Drawer>
      <DrawerMain id="RM">
        <Members members={members} />
      </DrawerMain>
    </DrawerLayout>
  );
}

/** The members' layout, with the conversation's bar holding the rooms'
 *  toggle (driven by the rooms layout's handle, as a chat's bar would). */
function Members({ members }: { members: boolean }) {
  const rooms: DrawerHandle = useDrawerHandle();
  return (
        <DrawerLayout side="end" collapseAt="sm" expanded={members} animate={false}>
          <Drawer
            id="MD" label="Members" variant="plain"
            head={<><span id="MS"><SearchField label="Find someone" value="" onValueChange={() => {}} /></span><DrawerToggle id="MH" shown="expanded" label={MEMBERS_TOGGLE} /></>}
            foot={<DrawerToggle id="MT" shown="collapsed" label={MEMBERS_TOGGLE} />}
          >
            <List aria-label="Members"><ListItem id="member-theo" media={<Avatar name="theo" size="sm" />} title="theo" /></List>
          </Drawer>
          <DrawerMain id="C"><DrawerToggle id="BT" drawer={rooms} label={ROOMS_TOGGLE} /> conversation</DrawerMain>
        </DrawerLayout>
  );
}

let root: HTMLElement | null = null;
(window as unknown as Record<string, unknown>).drawersFixture = {
  mount(width: number, rooms: boolean, members: boolean) {
    installFoundation();
    if (!root) {
      root = document.createElement('div');
      document.body.appendChild(root);
    }
    Object.assign(root.style, { width: `${width}px`, height: '600px' });
    render(<Screen rooms={rooms} members={members} />, root);
  },
};
