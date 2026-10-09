import type { ComponentChildren, JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { attachFitText, fitText, fitTextVars, type FitHandle } from '@boogy/web';

type FitTag = 'div' | 'p' | 'span' | 'h1' | 'h2' | 'h3';

export type FitTextProps = {
  /** The smallest size: any CSS length, container units included. */
  min: string;
  /** The largest size. */
  max: string;
  as?: FitTag;
  /** Texts given one group name share one fit factor: the largest at which
   *  every one of them fits. Members with equal `min` and `max` therefore come
   *  out at equal sizes; members with different bounds sit
   *  between their own bounds by the same factor. See `attachFitText()`. */
  group?: string;
  children?: ComponentChildren;
  style?: JSX.CSSProperties;
} & Omit<JSX.HTMLAttributes<HTMLElement>, 'as' | 'min' | 'max' | 'style' | 'ref'>;

/** Text at the largest size in [min, max] that fits its box. See `fitText()`. */
export function FitText({ min, max, as = 'div', group, children, style, ...rest }: FitTextProps) {
  const ref = useRef<HTMLElement>(null);
  const handle = useRef<FitHandle | null>(null);
  // A changed tag renders a new element: detach the old one, attach the new.
  // So does a changed group.
  useLayoutEffect(() => {
    const h = attachFitText(ref.current!, { group });
    handle.current = h;
    return () => h.detach();
  }, [as, group]);
  useLayoutEffect(() => {
    handle.current?.refit();
  }, [children, min, max]);
  const Tag = as as unknown as 'div';
  return (
    <Tag ref={ref as never} {...rest} {...fitText()} style={{ ...style, ...fitTextVars(min, max) } as JSX.CSSProperties}>
      {children}
    </Tag>
  );
}
