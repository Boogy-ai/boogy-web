import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { FillGrid } from './index';
import { flushRounds, setFrameScheduler } from '../src/components/measure';

let restore: (run: () => void) => void;
beforeEach(() => { restore = setFrameScheduler(() => {}); });
afterEach(() => { setFrameScheduler(restore); document.body.replaceChildren(); });

describe('<FillGrid>', () => {
  it('lays out its children and publishes the chosen shape; a box with no size falls back', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    act(() => render(
      <FillGrid aspect={1.6} minInline="7rem" minBlock="2.75rem" gap="1rem" role="radiogroup">
        <button>A</button><button>B</button><button>C</button>
      </FillGrid>, root));
    const el = root.firstElementChild as HTMLElement;
    expect(el.dataset.boogy).toBe('fill-grid');
    expect(el.getAttribute('role')).toBe('radiogroup');
    expect(el.style.getPropertyValue('--fill-gap')).toBe('1rem');
    expect(el.style.getPropertyValue('--fill-min-block')).toBe('2.75rem');
    flushRounds();
    expect(el.dataset.fallback).toBe('true');
    expect(el.style.getPropertyValue('--rows')).toBe('3');
  });

  it('a changed gap fits it again: the gap moves the cells while the box keeps its size', () => {
    let frames = 0;
    setFrameScheduler(() => { frames += 1; });
    const root = document.createElement('div');
    document.body.appendChild(root);
    const grid = (gap: string) => (
      <FillGrid aspect={1.6} minInline="7rem" minBlock="2.75rem" gap={gap}>
        <button>A</button><button>B</button>
      </FillGrid>
    );
    act(() => render(grid('1rem'), root));
    flushRounds();
    frames = 0;
    act(() => render(grid('3rem'), root));
    expect(frames).toBe(1);
  });
});
