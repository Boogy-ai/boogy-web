// form: a form laid out for a screen. Its fields scroll in its body, held to a
// readable width; its actions stay in a foot at the bottom, never scrolling in
// or out of view, lined up with the fields (a destructive one first). It
// fills the rest of the column it is put in, so give it a screen's column.
export interface FormAttrs {
  'data-boogy': 'form';
}

export function form(): FormAttrs {
  return { 'data-boogy': 'form' };
}
