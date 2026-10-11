import { describe, it, expect } from 'vitest';
import { sampleGrid } from './sample-grid';

describe('sampleGrid', () => {
  it('marks the grid', () => {
    expect(sampleGrid()).toEqual({ 'data-boogy': 'sample-grid' });
  });
});
