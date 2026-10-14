// Divider: a hairline between groups of related controls. Vertical (the
// default) in a bar of controls, horizontal between groups stacked in a
// column. A separator to assistive technology, holding nothing.

export type DividerOrientation = 'vertical' | 'horizontal';
export interface DividerOptions { orientation?: DividerOrientation }
export interface DividerAttrs {
  'data-boogy': 'divider';
  role: 'separator';
  'aria-orientation': DividerOrientation;
}
export function divider({ orientation = 'vertical' }: DividerOptions = {}): DividerAttrs {
  return { 'data-boogy': 'divider', role: 'separator', 'aria-orientation': orientation };
}
