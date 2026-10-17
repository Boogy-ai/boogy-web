// <Count>: a number beside a label, as a small badge of its own (see `count()`).
// Compact (10K), with the exact, grouped value as its title.
import type { JSX } from 'preact';
import { count, formatNumber } from '@boogy/web';

export type CountProps = { value: number; locale?: string } & Omit<JSX.HTMLAttributes<HTMLDataElement>, 'value'>;

export function Count({ value, locale, ...rest }: CountProps) {
  return (
    <data title={formatNumber(value, { locale })} {...rest} {...count()} value={String(value)}>
      {formatNumber(value, { variant: 'compact', locale })}
    </data>
  );
}
