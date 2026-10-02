// List item: leading media, then a title, subtitle and one-line description,
// then an `end` slot for one action. The whole row may itself be the control;
// when it is, `end` holds no second control. Trailing information that is not
// a control (a time, a count) is `meta`: the title and it share a `heading`
// row, the meta at its end.
export interface ListAttrs { 'data-boogy': 'list' }
export function list(): ListAttrs { return { 'data-boogy': 'list' }; }
export interface ListItemAttrs { 'data-boogy': 'list-item' }
export function listItem(): ListItemAttrs { return { 'data-boogy': 'list-item' }; }
