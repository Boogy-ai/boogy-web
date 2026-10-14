// <ColorSliders>: one colour as Hue, Saturation and Lightness sliders, in
// OKLCH. See `colorSliders()`. Each is a <Slider>: every step previews
// (`onValueInput`), and letting go commits once (`onValueChange`).
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { colorSliders, hexToSliders, sliderTracks, slidersToHex, type ColorSliderValues, type LightnessRange } from '@boogy/web';
import { Slider } from './slider';

export type ColorSlidersProps = {
  /** The colour, a `#rrggbb`. */
  value: string;
  /** Committed when a slider is let go, with the colour it makes. */
  onValueChange: (value: string) => void;
  /** Every step of a drag or a held key, for a live preview. */
  onValueInput?: (value: string) => void;
  /** Hold OKLCH lightness inside this range (each end 0–1). Default 0–1. */
  lightness?: LightnessRange;
  /** Default "Hue". */
  hueLabel?: string;
  /** Default "Saturation". */
  saturationLabel?: string;
  /** Default "Lightness". */
  lightnessLabel?: string;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'value' | 'onChange' | 'onInput'>;

type Key = keyof ColorSliderValues;

export function ColorSliders({
  value, onValueChange, onValueInput, lightness, hueLabel = 'Hue', saturationLabel = 'Saturation', lightnessLabel = 'Lightness', ...rest
}: ColorSlidersProps) {
  const [vals, setVals] = useState<ColorSliderValues>(() => hexToSliders(value, lightness));
  // What the sliders last made, or last read. A `value` equal to it is the
  // colour already shown, passed back: re-reading it would lose what a hex
  // cannot say (a grey's hue). Any other value is new, and is read in.
  const known = useRef(value);
  let shown = vals;
  if (value !== known.current) {
    shown = hexToSliders(value, lightness, vals.h);
    known.current = value;
    setVals(shown);
  }
  const move = (key: Key, to: number, commit: boolean) => {
    const next = { ...shown, [key]: to };
    const hex = slidersToHex(next);
    known.current = hex;
    setVals(next);
    (commit ? onValueChange : onValueInput)?.(hex);
  };
  const thumb = slidersToHex(shown);
  const tracks = sliderTracks(shown, lightness);
  const lo = Math.round((lightness?.min ?? 0) * 100);
  const hi = Math.round((lightness?.max ?? 1) * 100);
  const slider = (key: Key, label: string, min: number, max: number, track: string, format: (v: number) => string) => (
    <Slider label={label} value={shown[key]} min={min} max={max} track={track} thumb={thumb} format={format}
            onValueInput={(v) => move(key, v, false)} onValueChange={(v) => move(key, v, true)} />
  );
  return (
    <div {...rest} {...colorSliders()}>
      {slider('h', hueLabel, 0, 359, tracks.hue, (v) => `${v}°`)}
      {slider('s', saturationLabel, 0, 100, tracks.saturation, (v) => `${v}%`)}
      {slider('l', lightnessLabel, lo, hi, tracks.lightness, (v) => `${v}%`)}
    </div>
  );
}
