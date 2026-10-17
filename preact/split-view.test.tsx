import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { SplitView } from './index';

afterEach(() => { document.body.replaceChildren(); });
function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return root;
}
const REGIONS = [
  { id: 'members', label: 'Members', count: 10003, content: <p id="m">members</p> },
  { id: 'invites', label: 'Invites', count: 6, aside: true, content: <p id="i">invites</p> },
];

describe('<SplitView>', () => {
  it('a row of tabs, with counts, for when it is narrow; then every region, in order', () => {
    const root = mount(<SplitView label="Members and invites" collapseAt="lg" regions={REGIONS} />);
    const el = root.querySelector('[data-boogy="split-view"]')!;
    expect(el.getAttribute('data-collapse-at')).toBe('lg');
    const tabs = [...el.querySelectorAll('[role="tab"]')];
    expect(tabs.map((t) => t.textContent)).toEqual(['Members10K', 'Invites6']);
    expect(el.querySelector('[role="tablist"]')!.getAttribute('aria-label')).toBe('Members and invites');
    const regions = [...el.querySelectorAll('[data-slot="regions"] > [data-slot="region"]')];
    expect(regions.map((r) => r.getAttribute('data-region'))).toEqual(['members', 'invites']);
    expect(regions[0].hasAttribute('data-selected')).toBe(true);
    expect(regions[1].hasAttribute('data-selected')).toBe(false);
    expect(regions[1].hasAttribute('data-aside')).toBe(true);
    expect(regions.map((r) => r.getAttribute('aria-label'))).toEqual(['Members', 'Invites']);
    expect(el.querySelector('#m')).not.toBeNull();
    expect(el.querySelector('#i')).not.toBeNull();
  });
  it('choosing a tab selects its region, and says so', () => {
    const onSelect = vi.fn();
    const root = mount(<SplitView label="L" regions={REGIONS} onSelect={onSelect} />);
    const [, invites] = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    act(() => invites.click());
    expect(onSelect).toHaveBeenCalledWith('invites');
    const regions = [...root.querySelectorAll('[data-slot="region"]')];
    expect(regions[1].hasAttribute('data-selected')).toBe(true);
    expect(regions[0].hasAttribute('data-selected')).toBe(false);
  });
  it('one region: no row of tabs, at any width, and it shows', () => {
    const root = mount(<SplitView label="L" regions={[REGIONS[0]]} />);
    expect(root.querySelector('[data-slot="tabs"]')).toBeNull();
    expect(root.querySelector('[data-slot="region"]')!.hasAttribute('data-selected')).toBe(true);
  });
  it('a selected id that is no region shows the first, never nothing', () => {
    const root = mount(<SplitView label="L" regions={[REGIONS[0]]} selected="invites" onSelect={() => {}} />);
    expect(root.querySelector('[data-slot="region"]')!.hasAttribute('data-selected')).toBe(true);
  });
  it('narrow, the regions are the tabs\' panel, labelled by the selected tab', () => {
    const root = mount(<SplitView label="L" regions={REGIONS} />);
    const regions = root.querySelector('[data-slot="regions"]')!;
    const tab = root.querySelector('[role="tab"][aria-selected="true"]')!;
    expect(tab.getAttribute('aria-controls')).toBe(regions.id);
    // The test DOM draws the tabs (no stylesheet), so it is narrow here.
    expect(regions.getAttribute('role')).toBe('tabpanel');
    expect(regions.getAttribute('aria-labelledby')).toBe(tab.id);
  });
  it('controlled: the region the caller selects', () => {
    const root = mount(<SplitView label="L" regions={REGIONS} selected="invites" onSelect={() => {}} />);
    expect(root.querySelectorAll('[data-slot="region"]')[1].hasAttribute('data-selected')).toBe(true);
    expect(root.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toBe('Invites6');
  });
});
