// <NumericValue>: a number as people read it, grouped or compact, in the
// reader's locale (see `formatNumber()`). A compact one carries the exact,
// grouped value as its title.
import type { JSX } from 'preact';
import { formatNumber, numericValue, type NumberFormatOptions } from '@boogy/web';

export type NumericValueProps = { value: number } & NumberFormatOptions & Omit<JSX.HTMLAttributes<HTMLDataElement>, 'value'>;

export function NumericValue({ value, variant, decimals, trimZeros, locale, ...rest }: NumericValueProps) {
  const exact = variant === 'compact' ? formatNumber(value, { locale }) : undefined;
  return (
    <data title={exact} {...rest} {...numericValue({ variant })} value={String(value)}>
      {formatNumber(value, { variant, decimals, trimZeros, locale })}
    </data>
  );
}
