import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import type { StreamSocket, StreamTicket } from '@boogy/web';
import { useStream } from './stream';

function fakeIo() {
  const handlers = new Map<string, ((...a: any[]) => void)[]>();
  const emits: { payload: any; ack?: (r: any) => void }[] = [];
  let disconnected = 0;
  const socket: StreamSocket = {
    on: (e, fn) => { handlers.set(e, [...(handlers.get(e) ?? []), fn]); return socket; },
    emit: (_e, payload, ack) => { emits.push({ payload, ack }); return socket; },
    connect: () => socket,
    disconnect: () => { disconnected++; return socket; },
  };
  const fire = (e: string, ...a: any[]) => (handlers.get(e) ?? []).forEach((fn) => fn(...a));
  return { io: vi.fn(() => socket), fire, emits, disconnects: () => disconnected };
}
const ticket: StreamTicket = { grant: 'g', ttl_secs: 600, owner: 'o', service: 's', channel: 'c' };
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

function Probe(props: { io: any; enabled?: boolean }) {
  const status = useStream({ io: props.io, mint: async () => ticket, onEvent: () => {}, enabled: props.enabled, origin: 'x' });
  return <output>{status}</output>;
}

afterEach(() => { document.body.innerHTML = ''; });

function mount(node: preact.ComponentChild) {
  const root = document.createElement('div');
  document.body.append(root);
  act(() => render(node, root));
  return root;
}

describe('useStream', () => {
  it('reports connecting, then live once the subscribe is acknowledged', async () => {
    const f = fakeIo();
    const root = mount(<Probe io={f.io} />);
    expect(root.textContent).toBe('connecting');
    f.fire('connect');
    await flush();
    act(() => f.emits[0].ack!({ ok: true }));
    expect(root.textContent).toBe('live');
  });

  it('closes the stream when it unmounts', () => {
    const f = fakeIo();
    const root = mount(<Probe io={f.io} />);
    act(() => render(null, root));
    expect(f.disconnects()).toBe(1);
  });

  it('opens nothing while disabled', () => {
    const f = fakeIo();
    mount(<Probe io={f.io} enabled={false} />);
    expect(f.io).not.toHaveBeenCalled();
  });
});
