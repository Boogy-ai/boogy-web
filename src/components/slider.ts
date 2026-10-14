// Slider: a labelled range with its value shown beside its name. It shows
// every step of a drag or a held key as it happens, and commits once, when the
// person lets go — so what it changes can preview live and be saved once.

export interface SliderAttrs {
  'data-boogy': 'slider';
}

export function sliderControl(): SliderAttrs {
  return { 'data-boogy': 'slider' };
}

/** A slider's range: its ends and the step between its values. */
export interface SliderRange {
  min: number;
  max: number;
  step: number;
}

/** `value` held inside the range, on the nearest step from `min`. Not a
 *  number is `min`. */
export function clampSlider(value: number, { min, max, step }: SliderRange): number {
  if (Number.isNaN(value)) return min;
  const stepped = min + Math.round((value - min) / step) * step;
  return Math.min(max, Math.max(min, stepped));
}

/** The value a key moves a slider to from `value`, or null when the key is not
 *  one a slider handles: arrows step by one step, Page Up and Page Down by ten,
 *  Home and End go to the ends. */
export function stepSlider(key: string, value: number, range: SliderRange): number | null {
  const by = (n: number) => clampSlider(value + n * range.step, range);
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp': return by(1);
    case 'ArrowLeft':
    case 'ArrowDown': return by(-1);
    case 'PageUp': return by(10);
    case 'PageDown': return by(-10);
    case 'Home': return range.min;
    case 'End': return range.max;
    default: return null;
  }
}
