// The loader's retry, in a module of its own so its cache starts empty.
import { describe, it, expect } from 'vitest';
import { loadHighlighter, type Highlighter } from './code-block';

describe('loadHighlighter', () => {
  it('a failed load is forgotten, so the next block tries again', async () => {
    await expect(loadHighlighter(async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    const hl = { highlight: () => ({ value: '' }), getLanguage: () => undefined } as unknown as Highlighter;
    await expect(loadHighlighter(async () => hl)).resolves.toBe(hl);
  });
});
