// Button group: buttons joined into one partitioned shape. They sit edge to
// edge, the group's outer ends take the buttons' radius (a full pill with
// `rounded`), every corner where two meet is square, and a faint hairline
// marks each seam. The buttons are the caller's own and keep their variant,
// states and focus ring.
export interface ButtonGroupOptions {
  /** Round the outer ends fully, whatever the buttons' own radius. */
  rounded?: boolean;
}

export interface ButtonGroupAttrs {
  'data-boogy': 'button-group';
  role: 'group';
  'data-rounded'?: 'true';
}

export function buttonGroup(opts: ButtonGroupOptions = {}): ButtonGroupAttrs {
  const attrs: ButtonGroupAttrs = { 'data-boogy': 'button-group', role: 'group' };
  if (opts.rounded) attrs['data-rounded'] = 'true';
  return attrs;
}
