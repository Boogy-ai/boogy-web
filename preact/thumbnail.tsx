// <Thumbnail>: an image in a rounded square, or the label's initials on a
// tone from the label when there is no image or it fails to load.
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { initialsOf, thumbnail, type ThumbnailSize } from '@boogy/web';

export type ThumbnailProps = {
  /** What the image shows — its accessible name, and the initials' source. */
  label: string;
  src?: string;
  size?: ThumbnailSize;
  /** Shown beside its own label (a tile, a row): hidden from assistive tech,
   *  so the name is read once rather than twice. */
  decorative?: boolean;
} & Omit<JSX.HTMLAttributes<HTMLSpanElement>, 'size' | 'label'>;

export function Thumbnail({ label, src, size, decorative, ...rest }: ThumbnailProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const image = Boolean(src) && !failed;
  return (
    <span {...rest} {...(decorative ? { 'aria-hidden': 'true' } : { role: 'img', 'aria-label': label })} {...thumbnail({ label, size, image })}>
      {image ? <img src={src} alt="" onError={() => setFailed(true)} /> : <span aria-hidden="true">{initialsOf(label)}</span>}
    </span>
  );
}
