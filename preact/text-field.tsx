// <TextField>: a labelled one-line text input, with a message under it that
// takes no room while empty. `invalid` turns the edge and the message to
// danger. Any other input attribute (placeholder, type, spellcheck, …) passes
// through to the input.
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { field } from '@boogy/web';
import { charCount, describedBy, FieldMessage, overLimit } from './field-message';

export type TextFieldProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** A hint, or with `invalid` the reason the value is refused. */
  message?: ComponentChildren;
  invalid?: boolean;
  autoFocus?: boolean;
  /** `lg`: the field that is the main thing on its surface. */
  size?: 'md' | 'lg';
  /** The most characters it takes: counted under it ("6 / 60"). */
  maxLength?: number;
} & Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'label' | 'value' | 'onInput' | 'autoFocus' | 'size' | 'maxLength'>;

export function TextField({ label, value, onValueChange, message, invalid, autoFocus, size, maxLength, ...rest }: TextFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  // Focused ON MOUNT, by an effect: the `autofocus` attribute is honoured once
  // per page load, so a field that remounts would otherwise get no focus.
  useEffect(() => { if (autoFocus) input.current?.focus(); }, []);
  const messageId = `${id}-message`;
  return (
    <div {...field({ invalid: invalid || overLimit(value, maxLength), size })}>
      <label data-slot="label" for={id}>{label}</label>
      <input
        type="text"
        {...rest}
        ref={input}
        id={id}
        data-slot="control"
        value={value}
        aria-invalid={invalid || overLimit(value, maxLength) ? 'true' : undefined}
        aria-describedby={describedBy(messageId, message, maxLength)}
        onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => onValueChange(e.currentTarget.value)}
      />
      <FieldMessage id={messageId} message={message} length={charCount(value)} maxLength={maxLength} />
    </div>
  );
}
