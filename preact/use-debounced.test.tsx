import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { useDebounced } from './index';
import { SEARCH_DELAY_MS } from '@boogy/web';

afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); });

describe('useDebounced', () => {
  it('follows its value a moment after the last change, the search delay by default', () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    function Probe({ v }: { v: string }) { seen.push(useDebounced(v)); return null; }
    const root = document.createElement('div');
    document.body.appendChild(root);
    act(() => render(<Probe v="" />, root));
    act(() => render(<Probe v="g" />, root));
    act(() => render(<Probe v="ga" />, root));
    expect(seen.at(-1)).toBe('');
    act(() => { vi.advanceTimersByTime(SEARCH_DELAY_MS - 1); });
    expect(seen.at(-1)).toBe('');
    act(() => { vi.advanceTimersByTime(1); });
    expect(seen.at(-1)).toBe('ga');
  });
});
