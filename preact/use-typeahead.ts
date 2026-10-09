import { useRef } from 'preact/hooks';
import { typeahead, typeaheadSearch, type TypeaheadSearch } from '@boogy/web';

/** A menu's typeahead, one search per menu. Given a key press, the items'
 *  texts (asked for only when the key types) and the focused item's index:
 *  null when the key is no part of a search; otherwise the item the search
 *  now names, if any (`hit`), and the caller prevents the key's default. */
export function useTypeahead(): (e: KeyboardEvent, texts: () => readonly string[], from: number) => { hit: number | null } | null {
  const search = useRef<TypeaheadSearch>({ text: '', at: 0 });
  return (e, texts, from) => {
    const next = typeaheadSearch(search.current, e, Date.now());
    if (!next) return null;
    search.current = next;
    return { hit: typeahead(texts(), next.text, from) };
  };
}
