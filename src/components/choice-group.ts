// ChoiceGroup: one choice of several, each with a label and an optional line
// describing it. A fieldset of native radio inputs, so arrow keys, form
// semantics and the group's name come from the browser.
//
// `segmented`: the choices as one track of segments, for two to four short,
// fixed options (1 day / 7 days / 30 days). The radios stay native and
// focusable; only their labels are drawn. A segment shows no description.

export const CHOICE_GROUP_VARIANTS = ['list', 'segmented'] as const;
export type ChoiceGroupVariant = (typeof CHOICE_GROUP_VARIANTS)[number];

export interface ChoiceGroupOptions {
  /** `list` (the default): a radio and its label per line. `segmented`: one
   *  track of segments. */
  variant?: ChoiceGroupVariant;
  /** Segmented only: the track takes its container's width and the segments
   *  share it evenly, rather than each being as wide as its label. */
  fill?: boolean;
}

export interface ChoiceGroupAttrs {
  'data-boogy': 'choice-group';
  'data-variant'?: 'segmented';
  'data-fill'?: 'true';
}

export function choiceGroup(opts: ChoiceGroupOptions = {}): ChoiceGroupAttrs {
  const variant = opts.variant ?? 'list';
  if (!CHOICE_GROUP_VARIANTS.includes(variant)) {
    throw new Error(`choiceGroup(): variant must be one of ${CHOICE_GROUP_VARIANTS.join(', ')}, got "${variant}"`);
  }
  const attrs: ChoiceGroupAttrs = { 'data-boogy': 'choice-group' };
  if (variant === 'segmented') {
    attrs['data-variant'] = 'segmented';
    if (opts.fill) attrs['data-fill'] = 'true';
  }
  return attrs;
}
