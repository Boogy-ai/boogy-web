import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { committedValue, inlineEdit } from '@boogy/web';

export type InlineEditProps = {
  value: string;
  /** Called with the new text when an edit is committed — never with an empty
   *  or unchanged value. */
  onCommit: (value: string) => void;
  /** The accessible name: what the text is ("Document title", say). */
  label: string;
  maxLength?: number;
} & Omit<JSX.HTMLAttributes<HTMLInputElement>, 'value' | 'label' | 'maxLength' | 'onInput' | 'onKeyDown' | 'onBlur' | 'onFocus'>;

/** One line of text, edited in place. See `inlineEdit()`. */
export function InlineEdit({ value, onCommit, label, maxLength, ...rest }: InlineEditProps) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  const cancelled = useRef(false);
  // A value that changes from outside (a save landing, another device) replaces
  // the text — but never under the person typing.
  useEffect(() => { if (!editing.current) setDraft(value); }, [value]);
  return (
    <input
      {...rest}
      {...inlineEdit()}
      type="text"
      aria-label={label}
      value={draft}
      maxLength={maxLength}
      spellcheck={false}
      onFocus={() => { editing.current = true; cancelled.current = false; }}
      onInput={(e) => setDraft(e.currentTarget.value)}
      onKeyDown={(e) => {
        // An input method composing text (Japanese, Chinese, Korean…) uses
        // Enter to confirm a conversion and Escape to cancel it: those keys are
        // the composition's, not the edit's. 229 is the keyCode a browser
        // reports for a key the input method consumed.
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancelled.current = true; e.currentTarget.blur(); }
      }}
      onBlur={(e) => {
        editing.current = false;
        // From the element, not the closure: the last keystroke's state update
        // may not have rendered yet when Enter arrives.
        const next = cancelled.current ? null : committedValue(e.currentTarget.value, value, maxLength);
        setDraft(next ?? value);
        if (next !== null) onCommit(next);
      }}
    />
  );
}
