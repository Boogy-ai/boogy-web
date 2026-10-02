// The interface zoom for Preact: a hook over the page's zoom store, and the two
// buttons that step it. No provider: the zoom is page-wide, so every component
// reads the same value, and SDK components follow it through the stylesheet
// without reading it at all.
import { useEffect, useState } from 'preact/hooks';
import {
  zoomState, onZoomChange, zoomIn, zoomOut, resetZoom, stepZoom, canStepZoom, zoomControls, type ZoomState,
} from '@boogy/web';
import { Button } from './button';

export function useZoom(): ZoomState & { zoomIn(): void; zoomOut(): void; reset(): void } {
  const [state, setState] = useState(zoomState);
  useEffect(() => {
    setState(zoomState());
    return onZoomChange(setState);
  }, []);
  return { ...state, zoomIn, zoomOut, reset: resetZoom };
}

export type ZoomControlsProps = {
  /** Controlled: the value these buttons step. Omit it to step the page's own zoom. */
  value?: number;
  /** Controlled: called with the next step. */
  onValueChange?: (next: number) => void;
  size?: 'sm' | 'md';
  /** The group's name. Default "Size". */
  label?: string;
  /** Default "Smaller". */
  smallerLabel?: string;
  /** Default "Larger". */
  largerLabel?: string;
};

export function ZoomControls({
  value, onValueChange, size, label = 'Size', smallerLabel = 'Smaller', largerLabel = 'Larger',
}: ZoomControlsProps) {
  const page = useZoom();
  const current = value ?? page.own;
  const step = (direction: 1 | -1) => {
    if (value === undefined) {
      if (direction === 1) page.zoomIn(); else page.zoomOut();
      return;
    }
    const next = stepZoom(value, direction);
    if (next !== value) onValueChange?.(next);
  };
  return (
    <div {...zoomControls()} aria-label={label}>
      <Button variant="quiet" shape="icon" size={size} label={smallerLabel} data-slot="smaller"
              disabled={!canStepZoom(current, -1)} onClick={() => step(-1)}>
        <span data-slot="letter" aria-hidden="true">A</span>
      </Button>
      <Button variant="quiet" shape="icon" size={size} label={largerLabel} data-slot="larger"
              disabled={!canStepZoom(current, 1)} onClick={() => step(1)}>
        <span data-slot="letter" aria-hidden="true">A</span>
      </Button>
    </div>
  );
}
