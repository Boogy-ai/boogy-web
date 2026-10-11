// ChoiceGrid: the grid of choosable tiles that ColorPicker's swatches and
// SampleGrid are. Internal: each passes its own attributes and its tiles' slot.
//
//   * ONE tab stop: the chosen tile (else the first) — and, while focus is in
//     the grid, the focused one, so Tab and Shift+Tab leave the grid from where
//     focus is rather than stepping back into it.
//   * Arrow keys move focus between tiles (`moveInGrid`); Enter or Space
//     chooses. A key with Alt, Ctrl or Meta held is left to the page.
//   * Choosing the tile already chosen calls nothing.
import type { JSX, Ref } from 'preact';
import { useState } from 'preact/hooks';
import { moveInGrid } from '@boogy/web';

export const modified = (e: KeyboardEvent | PointerEvent) => e.altKey || e.ctrlKey || e.metaKey;

export type ChoiceTile = { id: string; label: string; style?: JSX.CSSProperties };

type ChoiceGridProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, 'ref'> & {
  tiles: readonly ChoiceTile[];
  /** The chosen tile's index; -1 for none. */
  chosen: number;
  columns: number;
  /** The tiles' `data-slot`. */
  tileSlot: string;
  onChoose: (id: string) => void;
  gridRef?: Ref<HTMLDivElement>;
};

export function ChoiceGrid({ tiles, chosen, columns, tileSlot, onChoose, gridRef, ...rest }: ChoiceGridProps) {
  const [focused, setFocused] = useState<number | null>(null);
  const stop = Math.min(focused ?? Math.max(chosen, 0), tiles.length - 1);
  const choose = (id: string) => { if (tiles[chosen]?.id !== id) onChoose(id); };
  const buttonsIn = (grid: EventTarget | null) =>
    Array.from((grid as HTMLElement).querySelectorAll<HTMLButtonElement>(`:scope > [data-slot="${tileSlot}"]`));
  return (
    <div
      {...rest}
      ref={gridRef}
      role="toolbar"
      onKeyDown={(e) => {
        if (modified(e)) return;
        const buttons = buttonsIn(e.currentTarget);
        const at = buttons.indexOf(e.target as HTMLButtonElement);
        if (at < 0) return;
        if (e.key === 'Enter' || e.key === ' ') {
          // Handled here, not by the button's own click, so it is one choice
          // however the browser activates a button.
          e.preventDefault();
          choose(tiles[at].id);
          return;
        }
        const to = moveInGrid(e.key, at, buttons.length, columns);
        if (to === null) return;
        e.preventDefault();
        buttons[to].focus();
      }}
      onKeyUp={(e) => {
        // Space activates a button on its release in some engines, even
        // when its press was handled: that would be a second choice.
        if (e.key === ' ' && !modified(e) && buttonsIn(e.currentTarget).includes(e.target as HTMLButtonElement)) e.preventDefault();
      }}
      onFocusIn={(e) => {
        const at = buttonsIn(e.currentTarget).indexOf(e.target as HTMLButtonElement);
        if (at >= 0) setFocused(at);
      }}
      onFocusOut={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(null);
      }}
    >
      {tiles.map((t, i) => (
        <button
          key={t.id}
          type="button"
          data-slot={tileSlot}
          aria-label={t.label}
          title={t.label}
          aria-pressed={i === chosen ? 'true' : 'false'}
          tabIndex={i === stop ? 0 : -1}
          style={t.style}
          onClick={() => choose(t.id)}
        />
      ))}
    </div>
  );
}
