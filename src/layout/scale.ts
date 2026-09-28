// Pane-relative scaling. A region's size unit `--u` follows one axis of its
// nearest sizing container, under one policy. These helpers only produce
// attributes; the foundation stylesheet does the arithmetic, so they work
// with any rendering library.

export type Axis = 'inline' | 'block' | 'min' | 'max' | 'diagonal';
export type Policy = 'fixed' | 'clamped' | 'fluid';

export interface Scale {
  axis?: Axis;
  policy?: Policy;
  /** Multiplier on 1% of the chosen axis. */
  factor?: number;
  /** Smallest `--u`, in rem, so browser zoom and user font size still act. */
  floor?: string;
  /** Largest `--u` under `clamped`, in rem. Ignored by `fluid` and `fixed`. */
  cap?: string;
  /** Names the component in dev-mode layout warnings. */
  component?: string;
}

export const DEFAULT_SCALE: Required<Omit<Scale, 'component'>> = {
  axis: 'min',
  policy: 'clamped',
  factor: 4,
  floor: '0.625rem',
  cap: '1.0625rem',
};

export interface ScaleAttrs {
  'data-u-axis': Axis;
  'data-u-policy': Policy;
  'data-component'?: string;
  style: Record<string, string>;
}

const REM = /^(\d+(\.\d+)?|\.\d+)rem$/;

function rem(value: string, field: string): number {
  if (!REM.test(value)) {
    throw new Error(`scale(): ${field} must be a rem length such as "0.75rem", got "${value}"`);
  }
  return parseFloat(value);
}

export function scale(s: Scale = {}): ScaleAttrs {
  const axis = s.axis ?? DEFAULT_SCALE.axis;
  const policy = s.policy ?? DEFAULT_SCALE.policy;
  const factor = s.factor ?? DEFAULT_SCALE.factor;
  const floor = s.floor ?? DEFAULT_SCALE.floor;
  const cap = s.cap ?? DEFAULT_SCALE.cap;

  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error(`scale(): factor must be a positive finite number, got ${factor}`);
  }
  if (rem(floor, 'floor') > rem(cap, 'cap')) {
    throw new Error(`scale(): floor ${floor} is above cap ${cap}`);
  }

  const attrs: ScaleAttrs = {
    'data-u-axis': axis,
    'data-u-policy': policy,
    style: { '--u-factor': String(factor), '--u-floor': floor, '--u-cap': cap },
  };
  if (s.component) attrs['data-component'] = s.component;
  return attrs;
}

/** A component's declared scale with a consumer's override laid over it. */
export function withScale(base: Scale, override?: Scale): Scale {
  return override ? { ...base, ...override } : base;
}

export type Sized = 'inline' | 'both';

/**
 * Marks a region as a sizing container. `inline` (the default) contains only
 * the inline axis; `both` contains both and needs a DEFINITE block size — on a
 * region whose height comes from its content, `both` collapses it to zero.
 */
export function surface(sized: Sized = 'inline'): { 'data-surface': Sized } {
  return { 'data-surface': sized };
}
