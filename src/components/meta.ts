// A caption line of separate facts — "dave · messaging · v1.2" — from the
// parts that are present. One definition, so every such line reads the same.

/** The present, non-blank parts, joined with a middle dot. */
export function metaLine(parts: readonly (string | null | undefined | false)[]): string {
  return parts.map((p) => (typeof p === 'string' ? p.trim() : '')).filter((p) => p !== '').join(' · ');
}
