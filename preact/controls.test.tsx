import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { ChoiceGroup, Count, Meter, Switch } from './index';

afterEach(() => { document.body.replaceChildren(); });
function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return root;
}

describe('<Meter>', () => {
  it('stacks its segments, each a share of max, with the total as its value and every segment in words', () => {
    const root = mount(<Meter label="Option A" max={20} segments={[
      { value: 12, color: 'var(--a)', label: 'signed in' },
      { value: 4, color: 'var(--a)', label: 'by invite', pattern: 'stripes' },
    ]} />);
    const el = root.querySelector('[data-boogy="meter"]') as HTMLElement;
    expect(el.getAttribute('aria-label')).toBe('Option A');
    expect(el.getAttribute('aria-valuenow')).toBe('16');
    expect(el.getAttribute('aria-valuetext')).toBe('12 signed in, 4 by invite');
    const segs = [...el.querySelectorAll<HTMLElement>('[data-slot="segment"]')];
    expect(segs.map((s) => s.style.width)).toEqual(['60%', '20%']);
    expect(segs[1].dataset.pattern).toBe('stripes');
    expect(segs[0].style.getPropertyValue('--segment-color')).toBe('var(--a)');
  });
});

describe('<Switch>', () => {
  it('toggles through onCheckedChange and says its state', () => {
    const onChange = vi.fn();
    const root = mount(<Switch checked={false} onCheckedChange={onChange} label="Voters can change their vote" />);
    const btn = root.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(btn.getAttribute('aria-checked')).toBe('false');
    expect(btn.textContent).toContain('Voters can change their vote');
    act(() => btn.click());
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('runs the consumer onClick first, and does not toggle when it prevents default', () => {
    const onChange = vi.fn();
    const seen = vi.fn();
    const root = mount(<Switch checked={false} onCheckedChange={onChange} label="x" onClick={seen} />);
    const btn = root.querySelector('[role="switch"]') as HTMLButtonElement;
    act(() => btn.click());
    expect(seen).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);

    const blocked = vi.fn();
    const root2 = mount(<Switch checked={false} onCheckedChange={blocked} label="y" onClick={(e) => e.preventDefault()} />);
    act(() => (root2.querySelector('[role="switch"]') as HTMLButtonElement).click());
    expect(blocked).not.toHaveBeenCalled();
  });
});

describe('<Switch> disabled', () => {
  it('is a disabled button, and a press changes nothing', () => {
    const onChange = vi.fn();
    const root = mount(<Switch checked={true} onCheckedChange={onChange} label="x" disabled />);
    const btn = root.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    act(() => btn.click());
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('<ChoiceGroup> description', () => {
  it('names a radio by its label alone and describes it by the description', () => {
    const root = mount(<ChoiceGroup label="L" name="n" value="a" onValueChange={() => {}} choices={[{ value: 'a', label: 'A', description: 'About A' }, { value: 'b', label: 'B' }]} />);
    const [a, b] = [...root.querySelectorAll<HTMLInputElement>('input')];
    const label = root.querySelector('label[data-slot="choice-label"]') as HTMLElement;
    const desc = root.querySelector('[data-slot="choice-description"]') as HTMLElement;
    // The description sits outside the <label>, so it is not in the radio's name.
    expect(label.contains(desc)).toBe(false);
    expect(a.getAttribute('aria-describedby')).toBe(desc.id);
    expect(desc.id).not.toBe('');
    expect(b.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('<ChoiceGroup> description press', () => {
  it('pressing a description chooses its radio, as pressing its label does', () => {
    const onChange = vi.fn();
    const root = mount(<ChoiceGroup label="L" name="n" value="a" onValueChange={onChange} choices={[{ value: 'a', label: 'A', description: 'About A' }, { value: 'b', label: 'B', description: 'About B' }]} />);
    const [, descB] = [...root.querySelectorAll<HTMLElement>('[data-slot="choice-description"]')];
    act(() => descB.click());
    expect(onChange).toHaveBeenCalledWith('b');
    // Still named by its label alone.
    const labelB = root.querySelectorAll('label[data-slot="choice-label"]')[1] as HTMLElement;
    expect(labelB.contains(descB)).toBe(false);
  });
  it('a description in a disabled group chooses nothing', () => {
    const onChange = vi.fn();
    const root = mount(<ChoiceGroup label="L" name="n" value="a" onValueChange={onChange} disabled choices={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B', description: 'About B' }]} />);
    act(() => (root.querySelector('[data-slot="choice-description"]') as HTMLElement).click());
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('<ChoiceGroup> disabled', () => {
  it('disables the group and every radio in it', () => {
    const root = mount(<ChoiceGroup label="L" name="n" value="a" onValueChange={() => {}} disabled choices={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />);
    expect((root.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    expect([...root.querySelectorAll<HTMLInputElement>('input')].map((i) => i.disabled)).toEqual([true, true]);
  });
});

describe('<ChoiceGroup>', () => {
  it('is a fieldset of named radios with labels and descriptions, reporting the choice through onValueChange', () => {
    const onChange = vi.fn();
    const root = mount(<ChoiceGroup label="Show results" name="reveal" value="on_close" onValueChange={onChange} choices={[
      { value: 'on_close', label: 'When I close the poll', description: 'Nobody sees results until then.' },
      { value: 'always', label: 'Live, for everyone' },
    ]} />);
    const fs = root.querySelector('fieldset[data-boogy="choice-group"]')!;
    expect(fs.querySelector('legend')!.textContent).toBe('Show results');
    const radios = [...fs.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((r) => [r.name, r.value, r.checked])).toEqual([['reveal', 'on_close', true], ['reveal', 'always', false]]);
    expect(fs.textContent).toContain('Nobody sees results until then.');
    act(() => radios[1].click());
    expect(onChange).toHaveBeenCalledWith('always');
  });
});

describe('<Count>', () => {
  it('shows the number compact, as a badge of its own, with the exact value as its title', () => {
    const root = mount(<Count value={10003} locale="en-US" />);
    const el = root.querySelector('[data-boogy="count"]')!;
    expect(el.tagName).toBe('DATA');
    expect(el.textContent).toBe('10K');
    expect(el.getAttribute('title')).toBe('10,003');
    expect(el.getAttribute('value')).toBe('10003');
  });
});

describe('<ChoiceGroup variant="segmented">', () => {
  const CHOICES = [{ value: 'active', label: 'Active' }, { value: 'removed', label: 'Removed', count: 1, description: 'Not shown here' }];
  it('native radios in one track; a count sits inside its label; no description is drawn', () => {
    const root = mount(<ChoiceGroup variant="segmented" label="Show" name="f" value="active" onValueChange={() => {}} choices={CHOICES} />);
    const group = root.querySelector('[data-boogy="choice-group"]')!;
    expect(group.getAttribute('data-variant')).toBe('segmented');
    const track = group.querySelector(':scope > [data-slot="choices"]')!;
    expect(track.querySelectorAll('input[type="radio"]').length).toBe(2);
    const removed = track.querySelectorAll('label[data-slot="choice-label"]')[1];
    expect(removed.querySelector('[data-boogy="count"]')?.textContent).toBe('1');
    expect(root.querySelector('[data-slot="choice-description"]')).toBeNull();
  });
  it('choosing a segment reports its value', () => {
    const onChange = vi.fn();
    const root = mount(<ChoiceGroup variant="segmented" label="Show" name="f" value="active" onValueChange={onChange} choices={CHOICES} />);
    act(() => root.querySelectorAll<HTMLLabelElement>('label[data-slot="choice-label"]')[1].click());
    expect(onChange).toHaveBeenCalledWith('removed');
  });
  it('hideLabel: the group is still named by its legend, which is not drawn', () => {
    const root = mount(<ChoiceGroup variant="segmented" hideLabel label="Show" name="f" value="active" onValueChange={() => {}} choices={CHOICES} />);
    const legend = root.querySelector('[data-boogy="choice-group"] > legend')!;
    expect(legend.textContent).toBe('Show');
    expect(legend.hasAttribute('data-visually-hidden')).toBe(true);
    const shown = mount(<ChoiceGroup label="Lasts" name="d" value="a" onValueChange={() => {}} choices={[{ value: 'a', label: 'A' }]} />);
    expect(shown.querySelector('legend')!.hasAttribute('data-visually-hidden')).toBe(false);
  });
  it('fill: the segments share the width', () => {
    const root = mount(<ChoiceGroup variant="segmented" fill label="Lasts" name="d" value="7" onValueChange={() => {}} choices={[{ value: '1', label: '1 day' }, { value: '7', label: '7 days' }]} />);
    expect(root.querySelector('[data-boogy="choice-group"]')!.getAttribute('data-fill')).toBe('true');
  });
  it('the plain list keeps its choices in the same slot, with their descriptions', () => {
    const root = mount(<ChoiceGroup label="L" name="n" value="a" onValueChange={() => {}} choices={[{ value: 'a', label: 'A', description: 'About A' }]} />);
    expect(root.querySelector('[data-slot="choices"] > [data-slot="choice"] > [data-slot="choice-description"]')).not.toBeNull();
  });
});
