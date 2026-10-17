// The line under a field: its hint or the reason its value is refused, and,
// for a field with a limit, how much of it is used ("62 / 200"). Both are the
// field's description. Takes no room while it says nothing.
import type { ComponentChildren } from 'preact';

/** How long a value is, in characters as a person counts them (an emoji is
 *  one), as a service counts them. */
export function charCount(value: string): number {
  return [...value].length;
}

/** Whether a value is past its field's limit. */
export function overLimit(value: string, maxLength: number | undefined): boolean {
  return maxLength != null && charCount(value) > maxLength;
}

/** What a field's control is described by: the line's id, while it says
 *  anything. */
export function describedBy(id: string, message: ComponentChildren, maxLength: number | undefined): string | undefined {
  return message || maxLength != null ? id : undefined;
}

export function FieldMessage({ id, message, length, maxLength, alert }: {
  id: string;
  message?: ComponentChildren;
  /** The value's length in characters, counted against `maxLength`. */
  length: number;
  maxLength?: number;
  /** The message is a refusal just made: said aloud at once. */
  alert?: boolean;
}) {
  return (
    <span data-slot="message" id={id} role={alert ? 'alert' : undefined}>
      {message}
      {maxLength != null && <span data-slot="count">{`${length} / ${maxLength}`}</span>}
    </span>
  );
}
