import { describe, expect, it } from 'vitest';
import { isServiceLabel } from './service-label';
// The cases every implementation of the check is held to.
import cases from './service-label.cases.json';

describe('isServiceLabel — the one label-shape check', () => {
  it('accepts every service label in the shared cases', () => {
    expect(cases.labels.length).toBeGreaterThan(0);
    for (const label of cases.labels) expect(isServiceLabel(label), label).toBe(true);
  });

  it('refuses everything else in the shared cases', () => {
    expect(cases.not_labels.length).toBeGreaterThan(0);
    for (const label of cases.not_labels) expect(isServiceLabel(label), JSON.stringify(label)).toBe(false);
  });
});
