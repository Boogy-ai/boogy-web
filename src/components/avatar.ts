// Avatar: a person, as a circle or a rounded square — their picture, or with
// none (or one that fails to load) their initials over art seeded from them,
// so the same person wears the same colours wherever they appear.

export const AVATAR_SIZES = ['sm', 'md', 'lg'] as const;
export type AvatarSize = (typeof AVATAR_SIZES)[number];
export const AVATAR_VARIANTS = ['circle', 'rounded'] as const;
export type AvatarVariant = (typeof AVATAR_VARIANTS)[number];

export interface AvatarAttrs {
  'data-boogy': 'avatar';
  'data-size': AvatarSize;
  'data-variant': AvatarVariant;
  'data-image': 'true' | 'false';
}

export function avatar(opts: { size?: AvatarSize; variant?: AvatarVariant; image: boolean }): AvatarAttrs {
  const size = opts.size ?? 'md';
  const variant = opts.variant ?? 'circle';
  if (!AVATAR_SIZES.includes(size)) {
    throw new Error(`avatar(): size must be one of ${AVATAR_SIZES.join(', ')}, got "${size}"`);
  }
  if (!AVATAR_VARIANTS.includes(variant)) {
    throw new Error(`avatar(): variant must be one of ${AVATAR_VARIANTS.join(', ')}, got "${variant}"`);
  }
  return { 'data-boogy': 'avatar', 'data-size': size, 'data-variant': variant, 'data-image': opts.image ? 'true' : 'false' };
}
