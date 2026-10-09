import type { JSX } from 'preact';
import { meter, segmentShares, segmentText, segmentTotal, type Segment } from '@boogy/web';

export type MeterProps = { label: string; max: number; segments: readonly Segment[] } & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'max'>;

/** A bar of stacked segments with an accessible value. See `meter()`. */
export function Meter({ label, max, segments, ...rest }: MeterProps) {
  const shares = segmentShares(segments, max);
  // The attrs carry the range as strings, which is what lands in the DOM;
  // Preact's types ask for numbers here, and take them back to strings.
  const a = meter({ value: segmentTotal(segments), max, text: segmentText(segments) });
  const attrs: JSX.HTMLAttributes<HTMLDivElement> = {
    ...a,
    'aria-valuemin': Number(a['aria-valuemin']),
    'aria-valuemax': Number(a['aria-valuemax']),
    'aria-valuenow': Number(a['aria-valuenow']),
  };
  return (
    <div {...rest} {...attrs} aria-label={label}>
      {segments.map((s, i) => (
        <span
          key={i}
          data-slot="segment"
          data-pattern={s.pattern ?? 'solid'}
          style={{ '--segment-color': s.color, width: `${shares[i]}%` } as JSX.CSSProperties}
        />
      ))}
    </div>
  );
}
