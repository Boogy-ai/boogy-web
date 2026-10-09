import type { JSX } from 'preact';
import { choiceGroup } from '@boogy/web';
import { useId } from './use-id';

/** One choice of a ChoiceGroup: its value, its label, and an optional line describing it. */
export interface ChoiceItem<V extends string> { value: V; label: string; description?: string }
export type ChoiceGroupProps<V extends string> = {
  label: string;
  name: string;
  value: V;
  choices: readonly ChoiceItem<V>[];
  onValueChange(value: V): void;
  disabled?: boolean;
} & Omit<JSX.HTMLAttributes<HTMLFieldSetElement>, 'onChange' | 'value'>;

/** One of several choices, each with an optional description. See `choiceGroup()`. */
export function ChoiceGroup<V extends string>({ label, name, value, choices, onValueChange, disabled, ...rest }: ChoiceGroupProps<V>) {
  const base = useId('choice-');
  return (
    <fieldset {...rest} {...choiceGroup()} disabled={disabled}>
      <legend>{label}</legend>
      {choices.map((c, i) => {
        const id = `${base}-${i}`;
        const descId = `${id}-description`;
        // The description sits beside the label, not inside it, so a radio's
        // name is its label alone and the description is read as its description.
        // Pressing it still chooses its radio, as pressing the label does: on a
        // phone the description is most of a choice. It presses the radio
        // itself, so a disabled radio stays unchosen.
        return (
          <div key={c.value} data-slot="choice">
            <input id={id} type="radio" name={name} value={c.value} checked={c.value === value} disabled={disabled}
              aria-describedby={c.description ? descId : undefined} onChange={() => onValueChange(c.value)} />
            <label for={id} data-slot="choice-label">{c.label}</label>
            {c.description && (
              <span id={descId} data-slot="choice-description"
                onClick={(e) => e.currentTarget.parentElement?.querySelector<HTMLInputElement>('input[type="radio"]')?.click()}>
                {c.description}
              </span>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
