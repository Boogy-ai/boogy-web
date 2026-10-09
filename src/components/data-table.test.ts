import { describe, it, expect } from 'vitest';
import { dataTable, sortState, visibleColumns } from './data-table';

const cols = [
  { priority: 1, min: 200 }, // question
  { priority: 1, min: 80 },  // signed in
  { priority: 1, min: 80 },  // by invite
  { priority: 2, min: 80 },  // status
  { priority: 2, min: 100 }, // created
  { priority: 3, min: 60 },  // links
  { priority: 3, min: 60 },  // opened
  { priority: 4, min: 100 }, // closed
  { priority: 4, min: 120 }, // rules
];

describe('visibleColumns', () => {
  it('keeps every column when they all fit', () => {
    expect(visibleColumns(cols, 2000).every(Boolean)).toBe(true);
  });

  it('drops the lowest priority first, the rightmost of a priority first', () => {
    // 880 total; 760 drops rules (120)
    expect(visibleColumns(cols, 760)).toEqual([true, true, true, true, true, true, true, true, false]);
    // 660 drops both priority-4 columns
    expect(visibleColumns(cols, 660)).toEqual([true, true, true, true, true, true, true, false, false]);
  });

  it('never drops a priority-1 column, even when they alone do not fit', () => {
    expect(visibleColumns(cols, 100)).toEqual([true, true, true, false, false, false, false, false, false]);
  });
});

describe('dataTable', () => {
  it('marks the table and spells aria-sort', () => {
    expect(dataTable()).toEqual({ 'data-boogy': 'data-table' });
    expect(sortState('descending')).toBe('descending');
    expect(sortState()).toBe('none');
  });
});
