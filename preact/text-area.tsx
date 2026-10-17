// <TextArea>: a labelled multi-line field, a TextField's sibling: its label,
// its control, and a message under it that takes no room while empty. It
// grows with its text and always shows at least `rows` lines. With
// `newlines={false}` it is one paragraph however it wraps (a title that must
// not scroll out of sight): Enter makes no line break. Any other textarea
// attribute passes through.
import type { ComponentChildren, JSX } from 'preact';
import { useId } from 'preact/hooks';
import { field } from '@boogy/web';
import { charCount, describedBy, FieldMessage, overLimit } from './field-message';

export type TextAreaProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** A hint, or with `invalid` the reason the value is refused. */
  message?: ComponentChildren;
  invalid?: boolean;
  /** The lines it shows at least. Default 2. */
  rows?: number;
  /** Line breaks may be typed. Default true. */
  newlines?: boolean;
  /** `lg`: the field that is the main thing on its surface. */
  size?: 'md' | 'lg';
  /** The most characters it takes: counted under it ("62 / 200"). */
  maxLength?: number;
} & Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'label' | 'value' | 'onInput' | 'rows' | 'size' | 'style' | 'maxLength'>;

export function TextArea({ label, value, onValueChange, message, invalid, rows = 2, newlines = true, size, onKeyDown, maxLength, ...rest }: TextAreaProps) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div {...field({ invalid: invalid || overLimit(value, maxLength), size })}>
      <label data-slot="label" for={id}>{label}</label>
      <textarea
        {...rest}
        id={id}
        data-slot="control"
        rows={rows}
        style={{ '--field-rows': String(rows) } as JSX.CSSProperties}
        value={value}
        aria-invalid={invalid || overLimit(value, maxLength) ? 'true' : undefined}
        aria-describedby={describedBy(messageId, message, maxLength)}
        onKeyDown={(e: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => {
          if (!newlines && e.key === 'Enter') e.preventDefault();
          (onKeyDown as ((e: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => void) | undefined)?.(e);
        }}
        onInput={(e: JSX.TargetedEvent<HTMLTextAreaElement>) => onValueChange(e.currentTarget.value)}
      />
      <FieldMessage id={messageId} message={message} length={charCount(value)} maxLength={maxLength} />
    </div>
  );
}
