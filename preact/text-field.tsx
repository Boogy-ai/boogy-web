// <TextField>: a labelled one-line text input, with a message under it that
// takes no room while empty. `invalid` turns the edge and the message to
// danger. Any other input attribute (placeholder, type, spellcheck, …) passes
// through to the input.
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { field } from '@boogy/web';

export type TextFieldProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** A hint, or with `invalid` the reason the value is refused. */
  message?: ComponentChildren;
  invalid?: boolean;
  autoFocus?: boolean;
} & Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'label' | 'value' | 'onInput' | 'autoFocus'>;

export function TextField({ label, value, onValueChange, message, invalid, autoFocus, ...rest }: TextFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  // Focused ON MOUNT, by an effect: the `autofocus` attribute is honoured once
  // per page load, so a field that remounts would otherwise get no focus.
  useEffect(() => { if (autoFocus) input.current?.focus(); }, []);
  const messageId = `${id}-message`;
  return (
    <div {...field({ invalid })}>
      <label data-slot="label" for={id}>{label}</label>
      <input
        type="text"
        {...rest}
        ref={input}
        id={id}
        data-slot="control"
        value={value}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={message ? messageId : undefined}
        onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => onValueChange(e.currentTarget.value)}
      />
      <span data-slot="message" id={messageId}>{message}</span>
    </div>
  );
}
