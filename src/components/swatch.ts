// Swatch: a small round sample of one colour, beside that colour's name — in a
// menu, a list, a legend. Decoration: the name next to it is what a screen
// reader announces, so the chip itself is hidden from assistive technology.

export interface SwatchAttrs {
  'data-boogy': 'swatch';
  'aria-hidden': 'true';
}

export function swatch(): SwatchAttrs {
  return { 'data-boogy': 'swatch', 'aria-hidden': 'true' };
}
