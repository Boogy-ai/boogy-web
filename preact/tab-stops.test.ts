import { describe, it, expect } from 'vitest';
import { trapTab } from './tab-stops';

function surface() {
  const el = document.createElement('div');
  el.innerHTML = '<button id="a">a</button><button disabled>x</button><input id="b"><button id="c" tabindex="-1">c</button><button id="d">d</button>';
  document.body.append(el);
  return el;
}
const press = (shiftKey = false, key = 'Tab') => new KeyboardEvent('keydown', { key, shiftKey, cancelable: true });

describe('trapTab', () => {
  it('Tab on the last tab stop wraps to the first', () => {
    const el = surface();
    (el.querySelector('#d') as HTMLElement).focus();
    const e = press();
    trapTab(e, el);
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('a');
    el.remove();
  });
  it('Shift+Tab on the first wraps to the last, skipping disabled and tabindex=-1', () => {
    const el = surface();
    (el.querySelector('#a') as HTMLElement).focus();
    const e = press(true);
    trapTab(e, el);
    expect(document.activeElement?.id).toBe('d');
    el.remove();
  });
  it('leaves Tab in the middle, and any other key, to the browser', () => {
    const el = surface();
    (el.querySelector('#b') as HTMLElement).focus();
    const tab = press();
    trapTab(tab, el);
    const other = press(false, 'Enter');
    trapTab(other, el);
    expect(tab.defaultPrevented || other.defaultPrevented).toBe(false);
    expect(document.activeElement?.id).toBe('b');
    el.remove();
  });
});
