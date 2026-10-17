// NumericValue: a number as people read it. Grouped the way the reader's
// locale groups it (4,200 in the US, 4.200 in Germany), or compact, abbreviated
// the locale's way (4.2K). The page shows it in a `<data>` element that carries
// the exact value.

export const NUMERIC_VARIANTS = ['grouped', 'compact'] as const;
export type NumericVariant = (typeof NUMERIC_VARIANTS)[number];

export interface NumberFormatOptions {
  /** `grouped` (the default): every digit, grouped the locale's way.
   *  `compact`: abbreviated the locale's way (4.2K, 4.2M). */
  variant?: NumericVariant;
  /** Decimal places to show, zeros included (4.00). Unset: as many as the
   *  number has, up to three, or the locale's own for compact. */
  decimals?: number;
  /** Drop the decimals when every one shown is zero (4.00 becomes 4; 4.50
   *  stays). Off by default. */
  trimZeros?: boolean;
  /** A BCP 47 locale (`de-DE`). Unset: the reader's own. */
  locale?: string;
}

function checked(variant: NumericVariant | undefined, fn: string): NumericVariant {
  const v = variant ?? 'grouped';
  if (!NUMERIC_VARIANTS.includes(v)) throw new Error(`${fn}: variant must be one of ${NUMERIC_VARIANTS.join(', ')}, got "${v}"`);
  return v;
}

/** `value` as text, formatted with `Intl.NumberFormat` (see the options). */
export function formatNumber(value: number, opts: NumberFormatOptions = {}): string {
  const variant = checked(opts.variant, 'formatNumber()');
  const base: Intl.NumberFormatOptions = variant === 'compact' ? { notation: 'compact' } : {};
  const { decimals, locale } = opts;
  if (decimals === undefined) return new Intl.NumberFormat(locale, base).format(value);
  const fixed = new Intl.NumberFormat(locale, { ...base, minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (!opts.trimZeros) return fixed.format(value);
  // Judged on the digits the formatter shows, so its own scaling (4000 is
  // 4.0K) and rounding (3.999 is 4.00) decide what counts as all zeros.
  const fraction = fixed.formatToParts(value).filter((p) => p.type === 'fraction').map((p) => p.value).join('');
  if (!/^0*$/.test(fraction)) return fixed.format(value);
  return new Intl.NumberFormat(locale, { ...base, maximumFractionDigits: 0 }).format(value);
}

export interface NumericValueAttrs {
  'data-boogy': 'numeric-value';
  'data-variant': NumericVariant;
}

export function numericValue(opts: { variant?: NumericVariant } = {}): NumericValueAttrs {
  return { 'data-boogy': 'numeric-value', 'data-variant': checked(opts.variant, 'numericValue()') };
}
