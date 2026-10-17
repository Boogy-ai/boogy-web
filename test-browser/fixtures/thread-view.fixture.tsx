// ThreadView over a fake room of 1,000 messages, 50 a page, read newest first.
// Some messages wrap to several lines, so pages differ in height. Counts the
// pages it was asked for.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { Bubble, ThreadView, TypingBubble, useThread, type ThreadApi } from '../../preact/index';
import { installFoundation, type CursorPageOf, type ThreadOrder } from '@boogy/web';

type M = { id: number; at: number; body: string };
const PER = 50;
let all: M[] = [];
const fetched: (string | null)[] = [];
const order: ThreadOrder<M> = { key: (m) => m.id, compare: (a, b) => a.at - b.at || a.id - b.id };
let failOlder = false;
async function load(cursor: string | null): Promise<CursorPageOf<M>> {
  fetched.push(cursor);
  await new Promise((r) => setTimeout(r, 5));
  if (failOlder && cursor !== null) throw new Error('offline');
  const below = cursor === null ? Infinity : Number(cursor);
  const items = all.filter((m) => m.id < below).reverse().slice(0, PER);
  const last = items[items.length - 1];
  return { items, next_cursor: last && last.id > 1 ? String(last.id) : null };
}
let api: ThreadApi<M> | null = null;
let setTyping: (on: boolean) => void = () => {};
function App() {
  api = useThread(load, order, []);
  const [typing, set] = useState(false);
  setTyping = set;
  return (
    <div style={{ height: '600px', width: '480px', display: 'flex', flexDirection: 'column' }}>
      <ThreadView id="TV" thread={api} label="Messages" renderItem={(m) => <Bubble>{m.body}</Bubble>}
        after={typing && <TypingBubble label="someone is typing" />} />
    </div>
  );
}
(window as unknown as Record<string, unknown>).threadFixture = {
  mount(n: number) {
    installFoundation();
    all = Array.from({ length: n }, (_, i) => ({ id: i + 1, at: (i + 1) * 10, body: `message ${i + 1}${i % 7 === 0 ? ' with a much longer body that wraps onto more than one line of the bubble' : ''}` }));
    document.body.innerHTML = '<div id="host"></div>';
    render(<App />, document.getElementById('host')!);
  },
  add(body: string, reveal: boolean) {
    const id = all.length + 1;
    const m = { id, at: id * 10, body };
    all.push(m);
    api!.add(m, { reveal });
  },
  /** A message revealed, then (once the view has put the reader at the end,
   *  before the browser reports that scroll) grown by `px`, as a message whose
   *  late parts (a link's card, an image) arrive grows. */
  async addThenGrow(body: string, px: number) {
    const el = document.getElementById('TV')!;
    const before = el.scrollTop;
    this.add(body, true);
    let turns = 0;
    while (el.scrollTop === before && turns < 50) { await Promise.resolve(); turns++; }
    this.grow(px);
    return { turns, moved: el.scrollTop !== before };
  },
  /** The newest message grown to `px` taller than it was. */
  grow(px: number) {
    const items = document.querySelectorAll<HTMLElement>('#TV [data-slot="item"]');
    items[items.length - 1].style.paddingBlockEnd = `${px}px`;
  },
  fetched: () => [...fetched],
  typing: (on: boolean) => setTyping(on),
  failOlder(on: boolean) { failOlder = on; },
  /** Many messages arrive at the server unseen (a disconnect); then a re-read. */
  async missMany(n: number) {
    for (let i = 0; i < n; i++) { const id = all.length + 1; all.push({ id, at: id * 10, body: `missed ${id}` }); }
    await api!.refreshNewest();
  },
  remove(id: number) { api!.remove(id); },
  /** Live messages, each added as it would arrive, at the server too. */
  live(n: number) {
    for (let i = 0; i < n; i++) { const id = all.length + 1; const m = { id, at: id * 10, body: `live ${id}` }; all.push(m); api!.add(m); }
  },
};
