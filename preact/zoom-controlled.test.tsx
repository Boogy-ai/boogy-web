import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

// Count subscriptions to the page zoom: a controlled ZoomControls steps a
// value of its caller's, so it must never subscribe (each subscription is a
// re-render on every page-zoom change it ignores).
const subscribe = vi.hoisted(() => vi.fn());
vi.mock('@boogy/web', async (importOriginal) => {
  const real = await importOriginal<typeof import('@boogy/web')>();
  return { ...real, onZoomChange: (l: Parameters<typeof real.onZoomChange>[0]) => { subscribe(); return real.onZoomChange(l); } };
});
const { ZoomControls } = await import('./zoom');

afterEach(() => { document.body.innerHTML = ''; subscribe.mockClear(); });

function mount(node: preact.ComponentChild) {
  const root = document.createElement('div');
  document.body.append(root);
  act(() => render(node, root));
  return root;
}

describe('<ZoomControls> subscriptions', () => {
  it('controlled: never subscribes to the page zoom', () => {
    mount(<ZoomControls value={1.25} onValueChange={() => {}} />);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('uncontrolled: subscribes, since it shows the page zoom', () => {
    mount(<ZoomControls />);
    expect(subscribe).toHaveBeenCalled();
  });
});
