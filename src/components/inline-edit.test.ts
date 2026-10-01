import { describe, it, expect } from 'vitest';
import { committedValue, inlineEdit } from './inline-edit';

describe('inlineEdit', () => {
  it('marks the element', () => {
    expect(inlineEdit()).toEqual({ 'data-boogy': 'inline-edit' });
  });
});

describe('committedValue', () => {
  it('commits the trimmed draft', () => {
    expect(committedValue('  New name  ', 'Old')).toBe('New name');
  });
  it('commits nothing for an empty or whitespace-only draft, which reverts', () => {
    expect(committedValue('', 'Old')).toBeNull();
    expect(committedValue('   ', 'Old')).toBeNull();
  });
  it('commits nothing when the trimmed draft equals the current value', () => {
    expect(committedValue(' Old ', 'Old')).toBeNull();
  });
  it('cuts the draft to maxLength', () => {
    expect(committedValue('abcdef', 'x', 3)).toBe('abc');
  });
  it('commits nothing for an untouched value longer than maxLength — never a truncated copy of it', () => {
    expect(committedValue('abcdef', 'abcdef', 3)).toBeNull();
  });
});
