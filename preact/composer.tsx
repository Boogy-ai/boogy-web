// <Composer>: where a message is written — a multi-line input in a field
// group that grows with its text, and a send button at its end. Enter sends;
// Shift+Enter starts a new line; Enter that finishes an IME composition is
// left to the IME. Blanks are never sent.
import type { JSX } from 'preact';
import { field } from '@boogy/web';
import { Button } from './button';
import { Glyph } from './glyphs';

export type ComposerProps = {
  /** The input's accessible name ("Message carol"). */
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Send what is written. Called only when it is not blank. */
  onSubmit: () => void;
  placeholder?: string;
  /** The send button's accessible name. Default "Send". */
  sendLabel?: string;
  /** `bar`: the bar that ends a page, as a composer in a sheet's foot is
   *  (for a page that is not a sheet). Default: a framed field. */
  variant?: 'bar';
} & Omit<JSX.HTMLAttributes<HTMLFormElement>, 'label' | 'value' | 'onSubmit'>;

export function Composer({ label, value, onValueChange, onSubmit, placeholder, sendLabel = 'Send', variant, ...rest }: ComposerProps) {
  const blank = value.trim() === '';
  const send = () => { if (!blank) onSubmit(); };
  return (
    <form {...rest} {...field({ variant })} onSubmit={(e) => { e.preventDefault(); send(); }}>
      <div data-slot="group">
        <textarea
          data-slot="control"
          rows={1}
          aria-label={label}
          placeholder={placeholder}
          value={value}
          onInput={(e: JSX.TargetedEvent<HTMLTextAreaElement>) => onValueChange(e.currentTarget.value)}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
            e.preventDefault();
            send();
          }}
        />
        <span data-slot="suffix">
          <Button type="submit" variant="solid" shape="icon" size="sm" rounded label={sendLabel} disabled={blank}>
            <Glyph shape="send" size="sm" />
          </Button>
        </span>
      </div>
    </form>
  );
}
