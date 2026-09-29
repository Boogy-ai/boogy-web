// Catalog: presenting Boogy apps — the entry shape the App* components show,
// and matching a search against it. Pure; no fetching, no navigation.

export interface AppLinks { source?: string; website?: string; docs?: string }

export interface AppEntry {
  /** Stable across renders and unique in one list. */
  key: string;
  name: string;
  /** Who publishes it: the owner's handle. */
  publisher: string;
  /** Which installed copy this is, when there can be more than one. */
  instance?: string;
  category?: string;
  description?: string;
  keywords: string[];
  version?: string;
  license?: string;
  links: AppLinks;
  /** An icon image; without one a placeholder is shown. */
  iconUrl?: string;
  /** `open`: it runs already. `install`: it is offered for installing. */
  action: 'open' | 'install';
}

/** How well `entry` matches `q` (lower-case, trimmed); `null` when it does not. */
function rank(entry: AppEntry, q: string): number | null {
  const name = entry.name.toLowerCase();
  if (name.startsWith(q)) return 0;
  if (name.split(/[\s\-_.]+/).some((w) => w.startsWith(q))) return 1;
  if (entry.keywords.some((k) => k.toLowerCase().includes(q))) return 2;
  if ((entry.category ?? '').toLowerCase().includes(q) || (entry.description ?? '').toLowerCase().includes(q)) return 3;
  return null;
}

/** The entries matching `query`, best first; ties keep their given order. */
export function matchApps(entries: readonly AppEntry[], query: string): AppEntry[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  return entries
    .map((entry, i) => ({ entry, i, r: rank(entry, q) }))
    .filter((m): m is { entry: AppEntry; i: number; r: number } => m.r !== null)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((m) => m.entry);
}
