// Sheet, field and section: what a standalone SDK page is built from — a
// popup or a full page that is not an app's own layout.
//
// - Sheet: fills the window. It carries the document baseline (ground, ink,
//   body font), a `head` slot, a `body` slot that alone scrolls, and a `foot`
//   slot that keeps the actions in view. Its head matches the popover's page
//   mode, so the two read as one design.
// - Field: a label (`label` slot), its control (`control` slot, on the input
//   itself), and a `message` slot that takes no room while empty. A `group`
//   frames the control with a leading `icon` or a fixed text `prefix`, and a
//   trailing `suffix`; `rounded` makes the frame a pill.
// - Section: a titled group; its `header` slot is the small uppercase caption.

export interface SheetAttrs { 'data-boogy': 'sheet' }
export function sheet(): SheetAttrs {
  return { 'data-boogy': 'sheet' };
}

export interface FieldOptions {
  /** The value is refused: the message and the control's edge turn to danger. */
  invalid?: boolean;
  /** Fully rounded: the frame is a pill. */
  rounded?: boolean;
}
export interface FieldAttrs { 'data-boogy': 'field'; 'data-invalid'?: 'true'; 'data-rounded'?: 'true' }
export function field(opts: FieldOptions = {}): FieldAttrs {
  const attrs: FieldAttrs = { 'data-boogy': 'field' };
  if (opts.invalid) attrs['data-invalid'] = 'true';
  if (opts.rounded) attrs['data-rounded'] = 'true';
  return attrs;
}

export interface SectionAttrs { 'data-boogy': 'section' }
export function section(): SectionAttrs {
  return { 'data-boogy': 'section' };
}
