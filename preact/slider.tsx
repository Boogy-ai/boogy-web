import type { JSX } from 'preact';
import { useCallback, useRef, useState } from 'preact/hooks';
import { clampSlider, sliderControl, stepSlider } from '@boogy/web';
import { useId } from './use-id';
import { modified } from './choice-grid';

export type SliderProps = {
  /** Its name ("Hue"), shown above it. */
  label: string;
  value: number;
  /** Default 0. */
  min?: number;
  /** Default 100. */
  max?: number;
  /** Default 1. */
  step?: number;
  /** Committed when the person lets go: a drag's release, a held key's
   *  release, or focus leaving while a key moved it. Once, and only when it
   *  ends somewhere other than where the move began. Once released, it shows
   *  `value` again, so update it as you commit. */
  onValueChange: (value: number) => void;
  /** Every step of a drag or a held key, for a live preview of what it
   *  changes. Nothing is committed by it; passing each step back in as
   *  `value` is fine. */
  onValueInput?: (value: number) => void;
  /** How its value reads, shown and spoken. Default the number. */
  format?: (value: number) => string;
  /** The track's paint, a CSS image (a gradient of what the slider changes).
   *  Default the plain track. */
  track?: string;
  /** The thumb's colour (the colour the slider makes). It is then ringed so
   *  it reads on any track. Default the ink. */
  thumb?: string;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'value' | 'onChange' | 'onInput' | 'min' | 'max' | 'step'>;

/** A ref that calls `commit` with an input's value on its native `change`:
 *  the slider released. Not `onChange`: where preact/compat is loaded (this
 *  package's own Button loads it), `onChange` on a range input is rewritten to
 *  `input`, which fires on every step of a drag. */
export function useCommit(commit: (value: string) => void) {
  const latest = useRef(commit);
  latest.current = commit;
  const on = useRef<{ el: HTMLInputElement; listener: () => void } | null>(null);
  return useCallback((el: HTMLInputElement | null) => {
    if (on.current) on.current.el.removeEventListener('change', on.current.listener);
    on.current = null;
    if (!el) return;
    const listener = () => latest.current(el.value);
    el.addEventListener('change', listener);
    on.current = { el, listener };
  }, []);
}

/** A labelled range, its value shown beside its name; live while moved,
 *  committed once when let go. See `sliderControl()`. */
export function Slider({
  label, value, min = 0, max = 100, step = 1, onValueChange, onValueInput, format = String, track, thumb, style, ...rest
}: SliderProps) {
  const base = useId('boogy-slider-');
  const range = { min, max, step };
  // While it is dragged or a key is held it shows where it is; committed, it
  // shows `value` again. A move is kept with the value it began from, so a new
  // value from outside always shows — even after a drag that ended where it
  // began, which fires no `change` to end it.
  const [moved, setMoved] = useState<{ from: number; at: number } | null>(null);
  const shown = moved?.from === value ? moved.at : value;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const pending = useRef(false);
  // Where this move began. What it commits is measured against this, not
  // against `value`: a caller previewing the move live may pass each step back
  // in as `value`, and the release must still commit.
  const began = useRef<number | null>(null);
  const slide = (to: number) => {
    began.current ??= value;
    shownRef.current = to;
    setMoved({ from: value, at: to });
    onValueInput?.(to);
  };
  const commit = (to: number) => {
    pending.current = false;
    setMoved(null);
    const from = began.current ?? value;
    began.current = null;
    const next = clampSlider(to, range);
    if (next !== from) onValueChange(next);
  };
  const ref = useCommit((v) => commit(Number(v)));
  const text = format(shown);
  const paint: Record<string, string> = {};
  if (track !== undefined) paint['--slider-paint'] = track;
  if (thumb !== undefined) paint['--slider-thumb'] = thumb;
  const merged = typeof style === 'object' && style !== null ? { ...(style as Record<string, string>), ...paint } : Object.keys(paint).length ? paint : style;

  return (
    <div {...rest} style={merged} {...sliderControl()}>
      <label for={`${base}-input`}>
        <span data-slot="label" id={`${base}-label`}>{label}</span>
        <span data-slot="value">{text}</span>
      </label>
      <input
        data-slot="input"
        data-thumb={thumb !== undefined ? '' : undefined}
        id={`${base}-input`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        aria-labelledby={`${base}-label`}
        aria-valuetext={text}
        ref={ref}
        onInput={(e) => slide(clampSlider(Number(e.currentTarget.value), range))}
        onKeyDown={(e) => {
          if (modified(e)) return;
          const next = stepSlider(e.key, shownRef.current, range);
          if (next === null) return;
          // Stepped here, so the key can be marked handled: a native step
          // would need the key left unhandled, and a menu around the slider
          // would then act on it too. Shown now, committed on the key's
          // release: a held key is one commit, not one per repeat.
          e.preventDefault();
          pending.current = true;
          if (next !== shownRef.current) slide(next);
        }}
        onKeyUp={(e) => {
          if (modified(e) || stepSlider(e.key, 0, range) === null) return;
          e.preventDefault();
          if (pending.current) commit(shownRef.current);
        }}
        onBlur={() => { if (pending.current) commit(shownRef.current); }}
      />
    </div>
  );
}
