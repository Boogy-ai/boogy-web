// InlineEdit: one line of text that reads as plain text until it is pointed at
// or focused, then edits in place — a name on a page, the title of a document.
// Enter or leaving the field commits; Escape puts the text back. An emptied
// field reverts rather than committing an empty value, since a thing that has a
// name should not lose it to a stray select-all and delete.

export interface InlineEditAttrs {
  'data-boogy': 'inline-edit';
}

export function inlineEdit(): InlineEditAttrs {
  return { 'data-boogy': 'inline-edit' };
}

/** What an edit commits: the trimmed draft (cut to `maxLength`), or `null` when
 *  there is nothing to commit — an empty draft, which reverts, or one that
 *  equals the current value once trimmed. */
export function committedValue(draft: string, current: string, maxLength?: number): string | null {
  let next = draft.trim();
  // Unchanged is decided BEFORE the cut: a current value already longer than
  // maxLength, focused and left, is not an edit — cutting first would commit a
  // truncated copy of it.
  if (next === current) return null;
  if (maxLength !== undefined) next = next.slice(0, maxLength);
  if (next === '' || next === current) return null;
  return next;
}
