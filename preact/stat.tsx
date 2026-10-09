import type { JSX } from 'preact';
import { stat } from '@boogy/web';
import { FitText } from './fit-text';

export type StatProps = {
  label: string;
  value: string;
  caption?: string;
  /** The value's size range, as CSS lengths. */
  min: string;
  max: string;
  /** Stats given one group name set their values at one size: the largest at
   *  which every one of them fits (a row of headline numbers). */
  group?: string;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'label' | 'value' | 'min' | 'max'>;

/** A headline number, fitted, over its label and an optional caption. See `stat()`. */
export function Stat({ label, value, caption, min, max, group, ...rest }: StatProps) {
  return (
    <div {...rest} {...stat()}>
      <FitText as="p" data-slot="value" min={min} max={max} group={group}>{value}</FitText>
      <p data-slot="label">{label}</p>
      {caption && <p data-slot="caption">{caption}</p>}
    </div>
  );
}
