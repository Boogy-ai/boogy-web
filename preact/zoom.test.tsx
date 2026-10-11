import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { resetZoom, zoomIn, zoomState, ZOOM_STEPS } from '@boogy/web';
import { ZoomControls, useZoom, Glyph } from './index';

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

describe('<ZoomControls> glyphs', () => {
  it('Smaller and Larger each hold their glyph (a letter with a down / up arrow), and no letter text', () => {
    const r = mount(<ZoomControls />);
    const glyph = (name: string) => btn(r, name).querySelector('svg[data-boogy="glyph"]')!;
    expect(glyph('Smaller')).toBeTruthy();
    expect(glyph('Larger')).toBeTruthy();
    const ref = mount(<><Glyph shape="text-smaller" /><Glyph shape="text-larger" /></>);
    const [down, up] = [...ref.querySelectorAll('svg[data-boogy="glyph"]')];
    expect(glyph('Smaller').innerHTML).toBe(down.innerHTML);
    expect(glyph('Larger').innerHTML).toBe(up.innerHTML);
    expect(r.querySelector('[data-slot="letter"]')).toBeNull();
    expect(btn(r, 'Smaller').textContent).toBe('');
  });
});

describe('useZoom', () => {
  it('with `slider`, a range over the same steps sits before the buttons, named by the group and saying the size', () => {
    const r = mount(<ZoomControls value={1.25} onValueChange={() => {}} slider label="Pane size" />);
    const group = r.querySelector<HTMLElement>('[data-boogy="zoom-controls"]')!;
    const kids = [...group.children] as HTMLElement[];
    expect(kids.map((k) => k.getAttribute('data-slot'))).toEqual(['slider', 'smaller', 'larger']);
    const range = kids[0] as HTMLInputElement;
    expect(range.type).toBe('range');
    expect(range.min).toBe('0');
    expect(range.max).toBe(String(ZOOM_STEPS.length - 1));
    expect(range.value).toBe(String(ZOOM_STEPS.indexOf(1.25)));
    expect(range.getAttribute('aria-label')).toBe('Pane size');
    expect(range.getAttribute('aria-valuetext')).toBe('125%');
    expect(mount(<ZoomControls value={1} onValueChange={() => {}} />).querySelector('[data-slot="slider"]')).toBeNull();
  });

  it('dragging the slider sets the size step by step: controlled reports it, uncontrolled sets the page zoom', () => {
    const onValueChange = vi.fn();
    const r = mount(<ZoomControls value={1} onValueChange={onValueChange} slider />);
    const range = r.querySelector<HTMLInputElement>('[data-slot="slider"]')!;
    act(() => { range.value = String(ZOOM_STEPS.indexOf(1.5)); range.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(onValueChange).toHaveBeenLastCalledWith(1.5);
    expect(zoomState().own).toBe(1);
    const page = mount(<ZoomControls slider />);
    const pr = page.querySelector<HTMLInputElement>('[data-slot="slider"]')!;
    act(() => { pr.value = String(ZOOM_STEPS.indexOf(0.9)); pr.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(zoomState().own).toBe(0.9);
  });

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
