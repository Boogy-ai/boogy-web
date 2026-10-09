import { toChildArray, type ComponentChildren, type JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { attachFillGrid, fillGrid, type FitHandle } from '@boogy/web';

export type FillGridProps = {
  /** A cell's preferred width ÷ height. */
  aspect?: number;
  /** The smallest cell, as CSS lengths. Below it, one scrolling column. */
  minInline: string;
  minBlock: string;
  /** The gap between cells; defaults to `--space-2`. */
  gap?: string;
  children: ComponentChildren;
  style?: JSX.CSSProperties;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'style'>;

/** Children in the grid shape that makes each cell largest. See `fillGrid()`. */
export function FillGrid({ aspect = 1.6, minInline, minBlock, gap, children, style, ...rest }: FillGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const count = toChildArray(children).length;
  const countRef = useRef(count);
  countRef.current = count;
  const handle = useRef<FitHandle | null>(null);
  useLayoutEffect(() => {
    const h = attachFillGrid(ref.current!, () => countRef.current, { aspect, minInline, minBlock });
    handle.current = h;
    return () => h.detach();
  }, [aspect, minInline, minBlock]);
  // A changed count or gap moves the cells, not the box: fitted again.
  useLayoutEffect(() => {
    handle.current?.refit();
  }, [count, gap]);
  const vars = { '--fill-min-block': minBlock, ...(gap ? { '--fill-gap': gap } : {}) };
  return (
    <div ref={ref} {...rest} {...fillGrid()} style={{ ...style, ...vars } as JSX.CSSProperties}>
      {children}
    </div>
  );
}
