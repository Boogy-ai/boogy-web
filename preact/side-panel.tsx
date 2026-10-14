// <SidePanel>: a modal panel docked to the inline-end edge, its content a
// <Sheet>. See `sidePanel()`. It is drawn in the browser's top layer, as a
// popover is, so nothing on the page can clip or cover it, and a popover
// opened from inside it draws over it. It adds what the attributes cannot:
// Close, Escape, a press outside it, Back while it fills the window, and focus
// moving in, staying in, and coming back.
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { sidePanel, type DrawerBreakpoint } from '@boogy/web';
import { Button } from './button';
import { Glyph } from './glyphs';
import { Sheet } from './sheet';
import { TAB_STOPS, trapTab } from './tab-stops';
import { useBelow } from './use-below';
import { useBackCloses } from './use-back-closes';

export type SidePanelProps = {
  isOpen: boolean;
  /** Asked with `false` by Close, Escape, and a press outside the panel. */
  onOpenChange: (open: boolean) => void;
  /** The dialog's accessible name. */
  label: string;
  /** The head's title. */
  title: ComponentChildren;
  /** A glyph before the title. */
  glyph?: ComponentChildren;
  /** A Back button first in the head, calling this. */
  onBack?: () => void;
  /** The Back button's name. Default "Back". */
  backLabel?: string;
  /** Controls at the end of the head, before Close. */
  end?: ComponentChildren;
  /** The actions held at the bottom (Cancel / Done, say). */
  foot?: ComponentChildren;
  /** Below this breakpoint the panel fills the window. Default `sm`; `false`
   *  keeps it docked at every width. */
  fullscreenBelow?: DrawerBreakpoint | false;
  /** Dim the page behind. Default false: the page shows at full strength, so
   *  what the panel changes can be watched. A press there closes the panel
   *  either way. */
  scrim?: boolean;
  /** The Close button's name. Default "Close". */
  closeLabel?: string;
  /** A line on the edge facing the page, in `--side-panel-edge` (the strong
   *  edge unless the app sets it, say to a colour of its own theme). None
   *  while the panel fills the window. Default false. */
  bordered?: boolean;
  children?: ComponentChildren;
};

/** How long the panel's slide in lasts, in ms, from its computed transition: 0
 *  when it does not slide. */
function slideMs(panel: HTMLElement): number {
  const raw = window.getComputedStyle(panel).transitionDuration || '';
  return Math.max(0, ...raw.split(',').map((t) => {
    const v = parseFloat(t);
    if (Number.isNaN(v)) return 0;
    return t.trim().endsWith('ms') ? v : v * 1000;
  }));
}

export function SidePanel({
  isOpen, onOpenChange, label, title, glyph, onBack, backLabel, end, foot,
  fullscreenBelow = 'sm', scrim = false, closeLabel = 'Close', bordered = false, children,
}: SidePanelProps) {
  const full = useBelow(fullscreenBelow);
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(() => onOpenChange(false));
  close.current = () => onOpenChange(false);
  // Filling the window it is a page: Back, or a phone's back gesture, takes it away.
  useBackCloses(isOpen && full, () => close.current());

  // READY once it has slid in: until then its body holds nothing, so what the
  // body draws (a grid of patterns, say) does not compete with the slide for
  // the frames, and then fades in. Its head and foot are there from the start.
  // No slide (reduced motion, no stylesheet) is ready at once.
  const [ready, setReady] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) { setReady(false); return; }
    const el = root.current as (HTMLDivElement & { showPopover?: () => void }) | null;
    const panel = dialog.current;
    if (!el || !panel) return;
    if (el.showPopover && !el.matches(':popover-open')) el.showPopover();
    opener.current = document.activeElement as HTMLElement | null;
    // Into the panel at once, so keys go to it while it slides in. Without
    // scrolling: it is still off screen, and a scroll to bring it into view
    // would jolt it (a bounce).
    panel.focus({ preventScroll: true });
    const slide = slideMs(panel);
    let timer = 0;
    const done = () => setReady(true);
    const onEnd = (e: Event) => { if (e.target === panel) done(); };
    if (slide === 0) done();
    else {
      panel.addEventListener('transitionend', onEnd);
      // A slide that never reports its end (interrupted, or a browser that
      // skips the event) is still over just after it should have ended.
      timer = window.setTimeout(done, slide + 100);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // A popover opened from inside the panel takes Escape first.
        if (panel.querySelector('[data-boogy="popover"]')) return;
        e.preventDefault();
        close.current();
        return;
      }
      if (e.defaultPrevented || !panel.contains(document.activeElement)) return;
      trapTab(e, panel);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      panel.removeEventListener('transitionend', onEnd);
      document.removeEventListener('keydown', onKey);
      if (panel.contains(document.activeElement) || document.activeElement === document.body || !document.activeElement) opener.current?.focus();
    };
  }, [isOpen]);

  // Ready, focus moves to the CONTENT first: the head's Back and Close come
  // before it in the tree, and opening a panel should not land on Close.
  useLayoutEffect(() => {
    const panel = dialog.current;
    if (!isOpen || !ready || !panel) return;
    if (panel !== document.activeElement && panel.contains(document.activeElement)) return;
    const body = panel.querySelector<HTMLElement>('[data-slot="body"]');
    (body?.querySelector<HTMLElement>(TAB_STOPS) ?? panel.querySelector<HTMLElement>(TAB_STOPS) ?? panel).focus({ preventScroll: true });
  }, [isOpen, ready]);

  if (!isOpen) return null;
  return (
    <div
      {...sidePanel({ full, scrim })}
      data-ready={ready ? '' : undefined}
      data-bordered={bordered ? '' : undefined}
      ref={root}
      popover="manual"
      onClick={(e) => { if (e.target === e.currentTarget) close.current(); }}
    >
      <div data-slot="panel" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={dialog}>
        <Sheet
          title={title}
          start={glyph}
          onBack={onBack}
          backLabel={backLabel}
          foot={foot}
          end={
            <>
              {end}
              <Button variant="quiet" shape="icon" label={closeLabel} onClick={() => close.current()}>
                <Glyph shape="close" />
              </Button>
            </>
          }
        >
          {ready ? children : null}
        </Sheet>
      </div>
    </div>
  );
}
