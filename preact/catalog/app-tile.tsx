import type { AppEntry } from '@boogy/web/catalog';
import { Tile } from '../tile';
import { AppIcon } from './app-icon';

/** One app in a grid; the whole tile selects it. */
export function AppTile({ entry, onSelect }: { entry: AppEntry; onSelect: (e: AppEntry) => void }) {
  return (
    <Tile as="button" media={<AppIcon entry={entry} />} title={entry.name}
          subtitle={entry.instance ?? entry.publisher} onClick={() => onSelect(entry)} />
  );
}
