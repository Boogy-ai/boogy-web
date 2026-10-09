// Switch: a labelled on/off control. A button with role="switch", so Space and
// Enter toggle it and a screen reader says "on" or "off".

export interface SwitchAttrs {
  'data-boogy': 'switch';
  role: 'switch';
  type: 'button';
  'aria-checked': 'true' | 'false';
}

export function switchControl(checked: boolean): SwitchAttrs {
  return { 'data-boogy': 'switch', role: 'switch', type: 'button', 'aria-checked': checked ? 'true' : 'false' };
}
