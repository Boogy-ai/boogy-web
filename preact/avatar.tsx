// <Avatar>: a person, as a circle (the default) or a rounded square — their
// picture, or with none (or one that fails to load) their initials over art
// seeded from them. A place or a group (a room) takes `art="flat"`: one bright
// colour seeded from it, set apart from people.
import type { JSX } from 'preact';
import { avatar, initialsOf, seededFlat, type AvatarArt, type AvatarSize, type AvatarVariant } from '@boogy/web';
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
  /** `gradient` (default): dark art, white initials, for a person. `flat`:
   *  one bright colour, initials in its ink, for a place or a group. */
  art?: AvatarArt;
  /** Shown beside the person's own name: hidden from assistive tech, so the
   *  name is read once rather than twice. */
  decorative?: boolean;
} & Omit<JSX.HTMLAttributes<HTMLSpanElement>, 'size' | 'name'>;

export function Avatar({ name, src, seed, size, variant, art = 'gradient', decorative, style, ...rest }: AvatarProps) {
  const [image, onError] = usePicture(src);
  const flat = art === 'flat' ? seededFlat(seed ?? name) : null;
  const colours = flat ? { '--avatar-fill': flat.fill, '--avatar-ink': flat.ink } : null;
  return (
    <span
      {...rest}
      style={colours ? (typeof style === 'string' ? `${style};--avatar-fill:${flat!.fill};--avatar-ink:${flat!.ink}` : { ...(style as object | undefined), ...colours }) : style}
      {...(decorative ? { 'aria-hidden': 'true' } : { role: 'img', 'aria-label': name })}
      {...avatar({ size, variant, art, image })}
    >
      {image ? (
        <img src={src} alt="" onError={onError} />
      ) : (
        <>
          {!flat && <SeededArt seed={seed ?? name} />}
          <span data-slot="initials" aria-hidden="true">{initialsOf(name)}</span>
        </>
      )}
    </span>
  );
}
