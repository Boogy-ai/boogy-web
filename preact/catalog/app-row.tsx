import type { AppEntry } from '@boogy/web/catalog';
import { ListItem } from '../list';
import { Button } from '../button';
import { AppIcon } from './app-icon';

/** "publisher · category · instance", the parts it has. */
export function appSubtitle(entry: AppEntry): string {
  return [entry.publisher, entry.category, entry.instance].filter((p) => p).join(' · ');
}

export const ACTION_LABEL = { open: 'Open', install: 'Install' } as const;

/** One app in a list: a press anywhere on the row selects it, the trailing
 *  button acts. The row's title is the selecting control, so the two are side
 *  by side rather than one inside the other. */
export function AppRow({ entry, onSelect, onAction, busy, note }: {
  entry: AppEntry; onSelect: (e: AppEntry) => void; onAction: (e: AppEntry) => void; busy?: boolean; note?: string;
}) {
  return (
    <ListItem
      media={<AppIcon entry={entry} size="sm" />}
      title={<button type="button" onClick={() => onSelect(entry)}>{entry.name}</button>}
      subtitle={appSubtitle(entry)}
      description={note ?? entry.description ?? undefined}
      end={
        <Button variant={entry.action === 'open' ? 'solid' : 'outline'} size="sm" disabled={busy} onClick={() => onAction(entry)}>
          {busy ? 'Installing…' : ACTION_LABEL[entry.action]}
        </Button>
      }
    />
  );
}
