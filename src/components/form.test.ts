import { describe, expect, it } from 'vitest';
import { form } from './form';
import { COMPONENTS_CSS } from './components-css';
import { FOUNDATION_CSS } from '../layout/foundation-css';

describe('form', () => {
  it('names itself', () => {
    expect(form()).toEqual({ 'data-boogy': 'form' });
  });

  it('its fields scroll and its foot does not', () => {
    expect(COMPONENTS_CSS).toMatch(/\[data-boogy="form"\] > \[data-slot="body"\] \{[^}]*overflow: auto/);
    expect(COMPONENTS_CSS).toMatch(/\[data-boogy="form"\] > \[data-slot="foot"\][^{]*\{[^}]*flex: none/);
  });

  it('its fields and actions take the form\'s width: no cap of its own, they grow with the pane', () => {
    expect(FOUNDATION_CSS).not.toContain('--form-max');
    expect(COMPONENTS_CSS).not.toMatch(/\[data-boogy="form"\][^{]*\{[^}]*max-inline-size/);
  });
});
