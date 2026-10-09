import { it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { BackButton } from './index';

afterEach(() => { document.body.innerHTML = ''; });

it('is the quiet icon button a head starts with, named Back unless told otherwise', () => {
  const root = document.createElement('div');
  document.body.append(root);
  const onClick = vi.fn();
  act(() => render(<><BackButton onClick={onClick} /><BackButton label="Back to the list" onClick={() => {}} /></>, root));
  const [a, b] = [...root.querySelectorAll('button')];
  expect(a.getAttribute('aria-label')).toBe('Back');
  expect(a.dataset.variant).toBe('quiet');
  expect(a.dataset.shape).toBe('icon');
  expect(b.getAttribute('aria-label')).toBe('Back to the list');
  act(() => a.click());
  expect(onClick).toHaveBeenCalledTimes(1);
});
