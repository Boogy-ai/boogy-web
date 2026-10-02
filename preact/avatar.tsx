// <Avatar>: a person, as a circle (the default) or a rounded square — their
// picture, or with none (or one that fails to load) their initials over art
// seeded from them.
import type { JSX } from 'preact';
import { avatar, initialsOf, type AvatarSize, type AvatarVariant } from '@boogy/web';
import { SeededArt } from './seeded-art';
import { usePicture } from './use-picture';

export type AvatarProps = {
  /** Who it is — the accessible name, and the initials' source. */
  name: string;
  /** Their picture. */
  src?: string;
  /** What the art is seeded from. Defaults to `name`; pass something that
   *  stays the same (an id, an address) so a rename keeps the colours. */
  seed?: string;
  size?: AvatarSize;
  variant?: AvatarVariant;
  /** Shown beside the person's own name: hidden from assistive tech, so the
   *  name is read once rather than twice. */
  decorative?: boolean;
} & Omit<JSX.HTMLAttributes<HTMLSpanElement>, 'size' | 'name'>;

export function Avatar({ name, src, seed, size, variant, decorative, ...rest }: AvatarProps) {
  const [image, onError] = usePicture(src);
  return (
    <span {...rest} {...(decorative ? { 'aria-hidden': 'true' } : { role: 'img', 'aria-label': name })} {...avatar({ size, variant, image })}>
      {image ? (
        <img src={src} alt="" onError={onError} />
      ) : (
        <>
          <SeededArt seed={seed ?? name} />
          <span data-slot="initials" aria-hidden="true">{initialsOf(name)}</span>
        </>
      )}
    </span>
  );
}
