import type { JSX } from 'preact';
import { useCallback, useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
  clampPercent, colorPicker, cssColorToHex, hexToHsv, hsvToHex, MAX_HUE, parseHexColor,
  stepArea, stepHue, stepPercent, type ColorSwatch, type Hsv,
} from '@boogy/web';
import { useId } from './use-id';
import { ChoiceGrid, modified } from './choice-grid';

export type ColorPickerProps = {
  /** The group's name ("Fill colour"). */
  label: string;
  swatches: readonly ColorSwatch[];
  /** A swatch id, or a custom `#rrggbb`. */
  value: string;
  /** A swatch chosen, or a custom colour committed: on a drag's release, a
   *  held key's release, the hue strip's release, or Enter or leaving the hex
   *  field. Only when the value changes: choosing the colour already chosen
   *  calls nothing. */
  onValueChange: (value: string) => void;
  /** Swatches per row. Default 10. */
  columns?: number;
  /** The custom colour's name. Default "Custom colour". */
  customLabel?: string;
  /** The saturation and brightness area's name. Default "Saturation and brightness". */
  areaLabel?: string;
  /** Read with the area's saturation. Default "Saturation". */
  saturationLabel?: string;
  /** Read with the area's brightness. Default "Brightness". */
  brightnessLabel?: string;
  /** The hue strip's name. Default "Hue". */
  hueLabel?: string;
  /** The hex field's name. Default "Hex". */
  hexLabel?: string;
  /** Opacity 0–100. With `onOpacityChange`, a transparency slider shows. Once
   *  released, the slider shows this again, so update it as you commit. */
  opacity?: number;
  /** Committed on the slider's release, never on every step of a drag; a
   *  held key commits once, when it is released. */
  onOpacityChange?: (opacity: number) => void;
  /** The slider's name. Default "Transparency". It shows TRANSPARENCY (100 − opacity). */
  opacityLabel?: string;
  /** The swatch grid's name, a toolbar's. Default "Swatches". */
  swatchesLabel?: string;
  /** Read as the custom colour's description while a custom colour is the
   *  one chosen, as a pressed swatch reads as pressed. Default "chosen". */
  chosenLabel?: string;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'value' | 'onChange'>;

/** What the custom colour shows when there is no colour to start from: a
 *  mid grey, its hue a blue, so the area is not a wall of red. */
const NEUTRAL: Hsv = { h: 210, s: 0, v: 50 };

const unit = (n: number) => Math.min(1, Math.max(0, n));

/** A colour moved to `next` from `prev`, keeping what `next` cannot say: a
 *  grey has no hue and black no saturation, so the hue strip and the area keep
 *  where they were rather than jump to red or to the left edge. */
const adopt = (prev: Hsv, next: Hsv): Hsv => ({
  h: next.s === 0 || next.v === 0 ? prev.h : next.h,
  s: next.v === 0 ? prev.s : next.s,
  v: next.v,
});

/** A hex as typed: `#rrggbb` or `rrggbb`, with space around it, in either case. */
const typedHex = (text: string) => {
  const t = text.trim();
  return parseHexColor(t.startsWith('#') ? t : `#${t}`);
};

/** The colour an element is painted with, as `#rrggbb`, or null when there is
 *  none to read (nothing painted, or a page without layout). */
function paintedColor(el: Element | undefined): string | null {
  if (!el) return null;
  const css = getComputedStyle(el).backgroundColor;
  if (!css || css === 'transparent' || /^rgba\(0, 0, 0, 0\)$/.test(css)) return null;
  const read = cssColorToHex(css);
  if (read) return read;
  // A form the reader does not know (lab(), a named colour): let a canvas
  // turn it into sRGB bytes.
  try {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return null;
  }
}

/** A ref that calls `commit` with an input's value on its native `change`:
 *  the slider released. Not `onChange`: where preact/compat is loaded (this
 *  package's own Button loads it), `onChange` on a range input is rewritten to
 *  `input`, which fires on every step of a drag. */
function useCommit(commit: (value: string) => void) {
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

/** A swatch grid, a custom colour (a saturation and brightness area, a hue
 *  strip, a hex field) and an optional transparency slider, in sections. See
 *  `colorPicker()`. */
export function ColorPicker({
  label, swatches, value, onValueChange, columns = 10, customLabel = 'Custom colour',
  areaLabel = 'Saturation and brightness', saturationLabel = 'Saturation', brightnessLabel = 'Brightness',
  hueLabel = 'Hue', hexLabel = 'Hex', opacity, onOpacityChange, opacityLabel = 'Transparency',
  swatchesLabel = 'Swatches', chosenLabel = 'chosen', style, ...rest
}: ColorPickerProps) {
  const base = useId('boogy-color-');
  const chosen = swatches.findIndex((s) => s.id === value);
  const custom = chosen < 0 ? parseHexColor(value) : null;
  const current = custom ?? value;
  const choose = (next: string) => { if (next !== current) onValueChange(next); };
  const gridRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  // THE CUSTOM COLOUR is the colour shown, in HSV. It starts from the value
  // (a custom hex, else the chosen swatch's colour, else a neutral grey) and
  // follows it whenever it changes from outside; the person's edits move it
  // live, and are committed when they let go. `known` is whether it says the
  // value's colour: while a chosen swatch's colour cannot be read, what is
  // drawn with it is the swatch's own colour.
  const startFrom = (): string | null =>
    custom ?? (chosen >= 0 ? cssColorToHex(swatches[chosen].color) ?? paintedColor(gridRef.current?.children[chosen]) : null);
  const [hsv, setHsv] = useState<Hsv>(() => {
    const hex = custom ?? (chosen >= 0 ? cssColorToHex(swatches[chosen].color) : null);
    return hex ? adopt(NEUTRAL, hexToHsv(hex)) : NEUTRAL;
  });
  const [known, setKnown] = useState(() => !!(custom ?? (chosen >= 0 && cssColorToHex(swatches[chosen].color))));
  const hsvRef = useRef(hsv);
  // The hex field's text while it differs from the colour shown, and whether
  // a commit of it was refused.
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const editHex = (text: string | null) => { draftRef.current = text; setDraft(text); };
  /** Show `next`; whatever was typed in the hex field gives way to it. */
  const show = (next: Hsv) => {
    hsvRef.current = next;
    setHsv(next);
    setKnown(true);
    editHex(null);
    setInvalid(false);
  };
  /** A key moved the colour, or a pointer is dragging it: not yet committed. */
  const pending = useRef(false);
  const dragging = useRef<number | null>(null);
  /** Commit a custom colour — unless it is the chosen swatch's own colour:
   *  then nothing changed, and the swatch stays the one chosen rather than
   *  becoming a custom copy of itself. */
  const commitColor = (hex: string) => {
    if (chosen >= 0 && hex === startFrom()) return;
    choose(hex);
  };
  const commitShown = () => {
    pending.current = false;
    commitColor(hsvToHex(hsvRef.current));
  };
  /** Back to the value's colour (a cancelled drag). */
  const revert = () => {
    const hex = startFrom();
    if (hex) show(adopt(hsvRef.current, hexToHsv(hex)));
  };
  const seedKey = custom ?? (chosen >= 0 ? swatches[chosen].color : '');
  useLayoutEffect(() => {
    if (pending.current || dragging.current !== null) return;
    const hex = startFrom();
    if (!hex) { setKnown(false); return; }
    if (hsvToHex(hsvRef.current) !== hex) show(adopt(hsvRef.current, hexToHsv(hex)));
    else setKnown(true);
  }, [seedKey]);

  const shown = hsvToHex(hsv);
  const drawn = known ? shown : chosen >= 0 ? swatches[chosen].color : shown;

  // The area: a pointer drag moves the colour live and commits on release; a
  // key moves it, and its release commits.
  const fromPointer = (e: PointerEvent) => {
    const r = areaRef.current!.getBoundingClientRect();
    const x = r.width > 0 ? unit((e.clientX - r.left) / r.width) : 0;
    const y = r.height > 0 ? unit((e.clientY - r.top) / r.height) : 0;
    show({ h: hsvRef.current.h, s: x * 100, v: (1 - y) * 100 });
  };
  const onAreaDown = (e: PointerEvent) => {
    if (e.button !== 0 || modified(e)) return;
    // Handled here: no text selection while dragging, and focus moved by
    // hand (a handled press moves none), so the keys go on from here.
    e.preventDefault();
    areaRef.current!.focus();
    areaRef.current!.setPointerCapture?.(e.pointerId);
    dragging.current = e.pointerId;
    fromPointer(e);
  };
  /** A drag that ended without its release (capture lost, or a move with the
   *  button no longer held): nothing is committed, and the value shows again. */
  const abandon = (e: PointerEvent) => {
    if (dragging.current !== e.pointerId) return;
    dragging.current = null;
    revert();
  };
  const onAreaMove = (e: PointerEvent) => {
    if (dragging.current !== e.pointerId) return;
    if ((e.buttons & 1) === 0) abandon(e);
    else fromPointer(e);
  };
  const onAreaUp = (e: PointerEvent) => {
    if (dragging.current !== e.pointerId) return;
    fromPointer(e);
    dragging.current = null;
    commitShown();
  };

  /** A held key's release, or focus leaving mid-press: commit what it showed. */
  const settle = () => { if (pending.current) commitShown(); };
  const onAreaKey = (e: KeyboardEvent) => {
    if (modified(e)) return;
    // Space means nothing here; marked handled so it does not scroll the menu.
    if (e.key === ' ') { e.preventDefault(); return; }
    const next = stepArea(e.key, hsvRef.current, e.shiftKey);
    if (!next) return;
    e.preventDefault();
    pending.current = true;
    show({ ...hsvRef.current, ...next });
  };
  const onAreaKeyUp = (e: KeyboardEvent) => {
    if (modified(e) || (e.key !== ' ' && !stepArea(e.key, NEUTRAL))) return;
    e.preventDefault();
    settle();
  };

  // The hue strip: dragged, it moves the colour live and commits on release
  // (its native `change`); a key steps it here, so it can be marked handled,
  // and its release commits.
  const hueRef = useCommit((v) => {
    show({ ...hsvRef.current, h: Number(v) });
    commitShown();
  });
  const onHueKey = (e: KeyboardEvent) => {
    if (modified(e)) return;
    const next = stepHue(e.key, hsvRef.current.h, e.shiftKey);
    if (next === null) return;
    e.preventDefault();
    pending.current = true;
    show({ ...hsvRef.current, h: next });
  };
  const onHueKeyUp = (e: KeyboardEvent) => {
    if (modified(e) || stepHue(e.key, 0) === null) return;
    e.preventDefault();
    settle();
  };

  // The hex field: Enter or leaving it commits what was typed, when it is a
  // colour; when it is not, the field says so and nothing is committed.
  const submitHex = () => {
    const text = draftRef.current;
    if (text === null) return;
    const next = typedHex(text);
    if (!next) { setInvalid(true); return; }
    show(adopt(hsvRef.current, hexToHsv(next)));
    commitColor(next);
  };

  // The slider shows transparency; what is stored is opacity. While it is
  // dragged or a key is held it shows where it is; committed, it shows
  // `opacity` again. A move is kept with the opacity it began from, so a new
  // opacity from outside always shows — even after a drag that ended where
  // it began, which fires no `change` to end it.
  const [dragged, setDragged] = useState<{ from: number; at: number } | null>(null);
  const opaque = clampPercent(opacity ?? 100);
  const clear = dragged?.from === opaque ? dragged.at : 100 - opaque;
  const clearRef = useRef(clear);
  clearRef.current = clear;
  const sliderPending = useRef(false);
  const slide = (to: number) => {
    clearRef.current = to;
    setDragged({ from: opaque, at: to });
  };
  const commitClear = (transparency: number) => {
    sliderPending.current = false;
    setDragged(null);
    const next = 100 - clampPercent(transparency);
    if (next !== opaque) onOpacityChange?.(next);
  };
  const sliderRef = useCommit((v) => commitClear(Number(v)));

  return (
    <div
      {...rest}
      {...colorPicker()}
      role="group"
      aria-label={label}
      style={{
        ...(typeof style === 'object' ? style : {}),
        '--color-picker-current': drawn,
        '--color-picker-hue': hsvToHex({ h: hsv.h, s: 100, v: 100 }),
      } as JSX.CSSProperties}
    >
      {/* The swatches: one tab stop, arrow keys between them (ChoiceGrid). */}
      <ChoiceGrid
        gridRef={gridRef}
        data-slot="swatches"
        aria-label={swatchesLabel}
        style={{ '--color-picker-columns': String(columns) } as JSX.CSSProperties}
        tiles={swatches.map((s) => ({ id: s.id, label: s.label, style: { '--swatch-color': s.color } as JSX.CSSProperties }))}
        chosen={chosen}
        columns={columns}
        tileSlot="swatch"
        onChoose={choose}
      />
      <div
        data-slot="custom"
        role="group"
        aria-label={customLabel}
        data-pressed={custom ? 'true' : undefined}
        aria-describedby={custom ? `${base}-chosen` : undefined}
      >
        <div
          ref={areaRef}
          data-slot="area"
          role="slider"
          tabIndex={0}
          aria-label={areaLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hsv.s)}
          aria-valuetext={`${saturationLabel} ${Math.round(hsv.s)}%, ${brightnessLabel} ${Math.round(hsv.v)}%`}
          onPointerDown={onAreaDown}
          onPointerMove={onAreaMove}
          onPointerUp={onAreaUp}
          onPointerCancel={abandon}
          onLostPointerCapture={abandon}
          onKeyDown={onAreaKey}
          onKeyUp={onAreaKeyUp}
          onBlur={settle}
        >
          <span data-slot="area-thumb" aria-hidden="true" style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }} />
        </div>
        <input
          data-slot="hue"
          type="range"
          min={0}
          max={MAX_HUE}
          step={1}
          value={Math.round(hsv.h)}
          aria-label={hueLabel}
          ref={hueRef}
          onInput={(e) => show({ ...hsvRef.current, h: Number(e.currentTarget.value) })}
          onKeyDown={onHueKey}
          onKeyUp={onHueKeyUp}
          onBlur={settle}
        />
        <div data-slot="hex-row">
          <span data-slot="preview" aria-hidden="true" />
          <input
            data-slot="hex"
            type="text"
            aria-label={hexLabel}
            aria-invalid={invalid ? 'true' : undefined}
            spellcheck={false}
            autocomplete="off"
            value={draft ?? shown}
            onInput={(e) => {
              const text = e.currentTarget.value;
              editHex(text);
              if (invalid && typedHex(text)) setInvalid(false);
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || modified(e)) return;
              // Marked handled, so a menu around the field does not act on it.
              e.preventDefault();
              submitHex();
            }}
            onBlur={submitHex}
          />
        </div>
        {/* The chosen state a pressed swatch gets from aria-pressed: read as
            the custom colour's description, never drawn (its ring shows it)
            nor read on its own (hidden). */}
        {custom && <span id={`${base}-chosen`} hidden>{chosenLabel}</span>}
      </div>
      {onOpacityChange && (
        <div data-slot="opacity">
          <label for={`${base}-opacity`}>
            <span data-slot="opacity-label" id={`${base}-opacity-label`}>{opacityLabel}</span>
            <span data-slot="opacity-value">{clear}%</span>
          </label>
          <input
            id={`${base}-opacity`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={clear}
            aria-labelledby={`${base}-opacity-label`}
            aria-valuetext={`${clear}%`}
            ref={sliderRef}
            onInput={(e) => slide(clampPercent(Number(e.currentTarget.value)))}
            onKeyDown={(e) => {
              if (modified(e)) return;
              const next = stepPercent(e.key, clearRef.current);
              if (next === null) return;
              // Stepped here, so the key can be marked handled: a native step
              // would need the key left unhandled, and a menu around the
              // slider would then act on it too. Shown now, committed on the
              // key's release: a held key is one commit, not one per repeat.
              e.preventDefault();
              sliderPending.current = true;
              slide(next);
            }}
            onKeyUp={(e) => {
              if (modified(e) || stepPercent(e.key, 0) === null) return;
              e.preventDefault();
              if (sliderPending.current) commitClear(clearRef.current);
            }}
            onBlur={() => { if (sliderPending.current) commitClear(clearRef.current); }}
          />
        </div>
      )}
    </div>
  );
}
