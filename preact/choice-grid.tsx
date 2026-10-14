// ChoiceGrid: the grid of choosable tiles that ColorPicker's swatches and
// SampleGrid are. Internal: each passes its own attributes and its tiles' slot.
//
//   * ONE tab stop: the chosen tile (else the first) — and, while focus is in
//     the grid, the focused one, so Tab and Shift+Tab leave the grid from where
//     focus is rather than stepping back into it.
//   * Arrow keys move focus between tiles (`moveInGrid`); Enter or Space
//     chooses. A key with Alt, Ctrl or Meta held is left to the page.
//   * Choosing the tile already chosen calls nothing.
//   * `lazy`: every tile is there from the start, named and reachable, but its
//     paint (its `style`) waits until it comes near the view, is chosen, or
//     takes focus. A tile still waiting is marked `data-pending`.
import type { JSX, Ref } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { moveInGrid } from '@boogy/web';
import { useRevealed } from './use-revealed';

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
  /** Paint each tile only once it comes near the view. */
  lazy?: boolean;
};

export function ChoiceGrid({ tiles, chosen, columns, tileSlot, onChoose, gridRef, lazy = false, ...rest }: ChoiceGridProps) {
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
        <Tile
          key={t.id}
          tile={t}
          slot={tileSlot}
          pressed={i === chosen}
          tabStop={i === stop}
          // The chosen and the focused tile are seen: painted whatever the scroll.
          lazy={lazy && i !== chosen && i !== focused}
          onClick={() => choose(t.id)}
        />
      ))}
    </div>
  );
}

function Tile({ tile, slot, pressed, tabStop, lazy, onClick }: {
  tile: ChoiceTile; slot: string; pressed: boolean; tabStop: boolean; lazy: boolean; onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const revealed = useRevealed(ref, { enabled: lazy });
  const painted = revealed || !lazy;
  return (
    <button
      ref={ref}
      type="button"
      data-slot={slot}
      data-pending={painted ? undefined : ''}
      aria-label={tile.label}
      title={tile.label}
      aria-pressed={pressed ? 'true' : 'false'}
      tabIndex={tabStop ? 0 : -1}
      style={painted ? tile.style : undefined}
      onClick={onClick}
    />
  );
}
