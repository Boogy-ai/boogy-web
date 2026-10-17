// A block whose highlighter failed to load tries again while it is shown. In
// a file of its own, so the loader's cache starts empty.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { CodeBlock } from './index';
import { loadHighlighter, type Highlighter } from '@boogy/web';

afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); });

describe('<CodeBlock> load retry', () => {
  it('plain while the highlighter will not load; highlighted once a retry gets it', async () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    document.body.appendChild(root);
    // The host's copy cannot load here, so the first attempt fails.
    act(() => render(<CodeBlock code="def f(): pass" language="py" />, root));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(root.querySelector('code .hljs-keyword')).toBeNull();
    // Wait for that first load to fail (it is the one still in flight), so it
    // is forgotten; then the vendored highlighter becomes loadable, and the
    // block's retry picks it up.
    await loadHighlighter().catch(() => {});
    const real = ((await import('../vendor/highlight-11.11.1.js' as string)) as { default: Highlighter }).default;
    await loadHighlighter(async () => real);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    // The retry re-runs the load as its render settles; let that land.
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(root.querySelector('code .hljs-keyword')?.textContent).toBe('def');
  });
});
