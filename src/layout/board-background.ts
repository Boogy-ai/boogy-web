// An app that shows the board's background: while a board frames it, the page
// draws no background of its own and renders in the board's colour scheme, so
// its text reads on what the board paints behind it. The board also tells it
// the colour it paints there, and the SDK takes its palette from that colour
// (`board-palette.ts`): written into the SDK's own layer, never inline, so an
// app's own tokens still outrank it.
import type { PaneScheme } from '../internal/pane-protocol';
import { boardPalette } from './board-palette';

const PALETTE_ID = 'boogy-board-palette';

/** The stylesheet the palette is: inside the SDK's foundation layer, on the
 *  page while it draws the board's background. */
export function boardPaletteCss(hex: string): string {
  const decls = Object.entries(boardPalette(hex)).map(([k, v]) => `${k}: ${v};`).join(' ');
  return `@layer boogy.foundation { :root[data-board-background] { ${decls} } }`;
}

/** Take the palette from the board's colour, or let it go (`null`). */
export function setBoardGround(hex: string | null): void {
  const existing = document.getElementById(PALETTE_ID);
  if (hex === null) {
    existing?.remove();
    return;
  }
  const style = existing ?? Object.assign(document.createElement('style'), { id: PALETTE_ID });
  style.textContent = boardPaletteCss(hex);
  if (!existing) document.head.append(style);
}

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
  setBoardGround(null);
  const root = document.documentElement;
  root.removeAttribute(ATTR);
  root.style.removeProperty('--scheme');
  root.style.removeProperty('color-scheme');
}
