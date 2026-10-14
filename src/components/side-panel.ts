// SidePanel: a modal panel docked to the inline-end edge, over the page. Its
// content is a Sheet: a head (Back, a glyph, the title, a bar of buttons
// ending in Close), a body that alone scrolls, and a foot of actions. The
// element named here is the whole window behind the panel (the backdrop); the
// panel itself is its `panel` slot.
//
// - `full`: the panel fills the window (a narrow screen).
// - `scrim`: the page behind is dimmed. Without it the page shows at full
//   strength, so a panel that changes the page shows each change as it is made.
//   A press on the page behind closes the panel either way.

export interface SidePanelOptions {
  full?: boolean;
  scrim?: boolean;
}
export interface SidePanelAttrs {
  'data-boogy': 'side-panel';
  'data-full'?: 'true';
  'data-scrim'?: 'true';
}
export function sidePanel({ full = false, scrim = false }: SidePanelOptions = {}): SidePanelAttrs {
  const attrs: SidePanelAttrs = { 'data-boogy': 'side-panel' };
  if (full) attrs['data-full'] = 'true';
  if (scrim) attrs['data-scrim'] = 'true';
  return attrs;
}
