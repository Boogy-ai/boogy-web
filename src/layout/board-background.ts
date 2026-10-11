// An app that shows the board's background: while a board frames it, the page
// draws no background of its own and renders in the board's colour scheme, so
// its text reads on what the board paints behind it. The board's colour is
// never told to the app — what shows behind a pane is the board's to decide.
import type { PaneScheme } from '../internal/pane-protocol';

const ATTR = 'data-board-background';

/** Draw no page background, in `scheme`. The scheme is set INLINE on the root:
 *  an app's own stylesheet may set `color-scheme` on `:root`, and an inline
 *  style outranks every stylesheet rule. */
export function setBoardBackground(scheme: PaneScheme): void {
  const root = document.documentElement;
  root.setAttribute(ATTR, '');
  root.style.setProperty('--scheme', scheme);
  root.style.colorScheme = scheme;
}

/** Back to the app's own background and scheme. */
export function clearBoardBackground(): void {
  const root = document.documentElement;
  root.removeAttribute(ATTR);
  root.style.removeProperty('--scheme');
  root.style.removeProperty('color-scheme');
}
