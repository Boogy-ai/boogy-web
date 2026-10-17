import type { JSX } from 'preact';
import { choiceGroup, type ChoiceGroupVariant } from '@boogy/web';
import { Count } from './count';
import { useId } from './use-id';

/** One choice of a ChoiceGroup: its value, its label, an optional line
 *  describing it (not drawn on a segment), and an optional count, a badge
 *  after its label. */
export interface ChoiceItem<V extends string> { value: V; label: string; description?: string; count?: number }
export type ChoiceGroupProps<V extends string> = {
  label: string;
  name: string;
  value: V;
  choices: readonly ChoiceItem<V>[];
  onValueChange(value: V): void;
  disabled?: boolean;
  /** `segmented`: one track of segments, for two to four short, fixed options. */
  variant?: ChoiceGroupVariant;
  /** Segmented only: the track takes the width, the segments share it. */
  fill?: boolean;
  /** Name the group without drawing its label, where what is around it says
   *  what it chooses (a filter in a panel's head). */
  hideLabel?: boolean;
} & Omit<JSX.HTMLAttributes<HTMLFieldSetElement>, 'onChange' | 'value'>;

/** One of several choices, each with an optional description. See `choiceGroup()`. */
export function ChoiceGroup<V extends string>({ label, name, value, choices, onValueChange, disabled, variant, fill, hideLabel, ...rest }: ChoiceGroupProps<V>) {
  const base = useId('choice-');
  const segmented = variant === 'segmented';
  return (
    <fieldset {...rest} {...choiceGroup({ variant, fill })} disabled={disabled}>
      <legend data-visually-hidden={hideLabel ? '' : undefined}>{label}</legend>
      <div data-slot="choices">
      {choices.map((c, i) => {
        const id = `${base}-${i}`;
        const descId = `${id}-description`;
        const description = segmented ? undefined : c.description;
        // The description sits beside the label, not inside it, so a radio's
        // name is its label alone and the description is read as its description.
        // Pressing it still chooses its radio, as pressing the label does: on a
        // phone the description is most of a choice. It presses the radio
        // itself, so a disabled radio stays unchosen.
        return (
          <div key={c.value} data-slot="choice">
            <input id={id} type="radio" name={name} value={c.value} checked={c.value === value} disabled={disabled}
              aria-describedby={description ? descId : undefined} onChange={() => onValueChange(c.value)} />
            <label for={id} data-slot="choice-label">{c.label}{c.count !== undefined && <Count value={c.count} />}</label>
            {description && (
              <span id={descId} data-slot="choice-description"
                onClick={(e) => e.currentTarget.parentElement?.querySelector<HTMLInputElement>('input[type="radio"]')?.click()}>
                {description}
              </span>
            )}
          </div>
        );
      })}
      </div>
    </fieldset>
  );
}
