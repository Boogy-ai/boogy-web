import { describe, it, expect } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { Divider } from './index';

const mount = (node: preact.ComponentChild) => {
  const root = document.createElement('div');
  act(() => render(node, root));
  return root.firstElementChild as HTMLElement;
};

describe('<Divider>', () => {
  it('a separator, vertical unless told otherwise, holding nothing', () => {
    const el = mount(<Divider />);
    expect(el.getAttribute('data-boogy')).toBe('divider');
    expect(el.getAttribute('role')).toBe('separator');
    expect(el.getAttribute('aria-orientation')).toBe('vertical');
    expect(el.childNodes.length).toBe(0);
    expect(mount(<Divider orientation="horizontal" />).getAttribute('aria-orientation')).toBe('horizontal');
  });
  it('passes its other attributes through', () => {
    expect(mount(<Divider className="x" />).className).toBe('x');
  });
});
