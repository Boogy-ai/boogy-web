import type { AppEntry } from '@boogy/web/catalog';
import type { ThumbnailSize } from '@boogy/web';
import { Thumbnail } from '../thumbnail';

/** The app's icon, or its placeholder. Always shown beside the app's name, so
 *  it is decorative: the name is what gets read. */
export function AppIcon({ entry, size }: { entry: AppEntry; size?: ThumbnailSize }) {
  return <Thumbnail label={entry.name} src={entry.iconUrl} size={size} decorative />;
}
