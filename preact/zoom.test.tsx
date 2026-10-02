import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { resetZoom, zoomIn, zoomState } from '@boogy/web';
import { ZoomControls, useZoom } from './index';

afterEach(() => { act(() => resetZoom()); document.body.innerHTML = ''; });

function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  document.body.append(root);
  act(() => render(node, root));
  return root;
}
const btn = (r: HTMLElement, name: string) => r.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement;

describe('<ZoomControls>', () => {
  it('is a group named "Size" with a Smaller and a Larger button', () => {
    const r = mount(<ZoomControls />);
    const group = r.querySelector('[data-boogy="zoom-controls"]')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Size');
    expect(btn(r, 'Smaller')).toBeTruthy();
    expect(btn(r, 'Larger')).toBeTruthy();
  });

  it("uncontrolled, it steps the page's own zoom and disables Larger at the top", () => {
    const r = mount(<ZoomControls />);
    act(() => btn(r, 'Larger').click());
    expect(zoomState().own).toBe(1.1);
    for (let i = 0; i < 6; i++) act(() => btn(r, 'Larger').click());
    expect(zoomState().own).toBe(2);
    expect(btn(r, 'Larger').disabled).toBe(true);
    expect(btn(r, 'Smaller').disabled).toBe(false);
  });

  it("controlled, it reports the next step and leaves the page's zoom alone", () => {
    const onValueChange = vi.fn();
    const r = mount(<ZoomControls value={1.25} onValueChange={onValueChange} />);
    act(() => btn(r, 'Larger').click());
    expect(onValueChange).toHaveBeenLastCalledWith(1.5);
    act(() => btn(r, 'Smaller').click());
    expect(onValueChange).toHaveBeenLastCalledWith(1.1);
    expect(zoomState().own).toBe(1);
  });

  it('controlled, it disables each button at its end of the ladder', () => {
    const r = mount(<ZoomControls value={0.8} onValueChange={() => {}} />);
    expect(btn(r, 'Smaller').disabled).toBe(true);
    const r2 = mount(<ZoomControls value={2} onValueChange={() => {}} />);
    expect(btn(r2, 'Larger').disabled).toBe(true);
  });
});

describe('useZoom', () => {
  it('re-renders when the zoom changes anywhere on the page', () => {
    function Show() {
      const z = useZoom();
      return <span>{z.zoom}</span>;
    }
    const r = mount(<Show />);
    expect(r.textContent).toBe('1');
    act(() => zoomIn());
    expect(r.textContent).toBe('1.1');
  });
});
