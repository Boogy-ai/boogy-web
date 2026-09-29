// <SearchField>: a search input with an icon and a clear button. Escape
// clears a field that has text and is otherwise left for its container.
import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { field } from '@boogy/web';
import { Button } from './button';

export type SearchFieldProps = {
  /** The input's accessible name. */
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: KeyboardEvent) => void;
  /** Sees a paste first; `preventDefault()` takes it over — e.g. to keep a
   *  multi-line paste's line breaks, which a one-line input strips. */
  onPaste?: (e: ClipboardEvent) => void;
};

export function SearchField({ label, value, onValueChange, placeholder, autoFocus, onKeyDown, onPaste }: SearchFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const clear = () => { onValueChange(''); input.current?.focus(); };
  // Focused ON MOUNT, by an effect: the `autofocus` attribute is honoured once
  // per page load, so a field that remounts (returning from another view)
  // would otherwise leave focus on nothing.
  useEffect(() => { if (autoFocus) input.current?.focus(); }, []);
  return (
    <div {...field()}>
      <div data-slot="group">
        <span data-slot="prefix" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          ref={input}
          data-slot="control"
          type="search"
          aria-label={label}
          placeholder={placeholder}
          value={value}
          autocomplete="off"
          spellcheck={false}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => onValueChange(e.currentTarget.value)}
          onPaste={onPaste}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Escape' && value !== '') { e.preventDefault(); e.stopPropagation(); clear(); return; }
            onKeyDown?.(e);
          }}
        />
        {value !== '' && (
          <span data-slot="suffix">
            <Button variant="quiet" shape="icon" size="sm" label="Clear" onClick={clear}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}
