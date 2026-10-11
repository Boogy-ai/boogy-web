// Popover for Preact apps: a panel anchored to a trigger, above everything on
// the page. Its placement is the core `place()` (React Aria's rules, the
// primitive under HeroUI v3); it renders in the browser's top layer (the
// `popover` attribute), so no ancestor's overflow or stacking can clip or
// cover it.
//
// On a small screen it is a PAGE instead: the whole screen, a head with a back
// button, and a history entry, so the device's back button or gesture closes
// it. Closing it any other way steps that entry back off, so none is left
// behind.
import { type ComponentChildren, type JSX, type RefObject } from 'preact';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Button } from './button';
import { BackButton } from './back-button';
import { Glyph } from './glyphs';
import { TAB_STOPS } from './tab-stops';
import { DRAWER_BREAKPOINTS, place, popover, type DrawerBreakpoint, type PopoverMode, type PopoverPlacement, type PopoverVariant } from '@boogy/web';


export type PopoverProps = {
  /** The element it is anchored to; focus returns here when it closes. */
  triggerRef: RefObject<HTMLElement>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** "side align", e.g. `bottom start`. Default `bottom`. */
  placement?: PopoverPlacement;
  /** Gap from the trigger, px. Default 8. */
  offset?: number;
  /** Shift along the trigger, px. Default 0. */
  crossOffset?: number;
  /** Flip to the opposite side when that side has more room. Default true. */
  shouldFlip?: boolean;
  /** Minimum gap from the viewport's edges, px. Default 12. */
  containerPadding?: number;
  maxHeight?: number;
  /** `raised` (default): rounded, with a shadow. `flat`: square corners, a
   *  hairline edge, no shadow, square menu rows; its colours stay the app's
   *  (`--popover-ground`, `--popover-edge`). */
  variant?: PopoverVariant;
  /** Its ground: any CSS colour (a `var()` is fine). Default the theme's
   *  popover ground. */
  ground?: string;
  /** Below this viewport width it opens as a full-screen page. Default `sm`; `false` never. */
  fullscreenBelow?: DrawerBreakpoint | false;
  /** The dialog's accessible name, and its head's title where it has a head
   *  (the full-screen page, a centred popover, or one with `onBack`). */
  title?: string;
  /** A glyph before the head's title. Decoration — the title alone names the
   *  dialog. */
  titleIcon?: ComponentChildren;
  /** In the middle of the viewport instead of against its trigger (which it
   *  still returns focus to). `placement`, `offset`, `crossOffset` and
   *  `shouldFlip` do not apply. Default false. */
  centered?: boolean;
  /** When `centered`: where the box sits vertically, as the share of the free
   *  space above it — 0.5 (the default) is the middle, 1/3 leaves a third
   *  above and two thirds below, the usual place for a dialog. Clamped to
   *  0..1, and never closer to an edge than `containerPadding`. */
  centerY?: number;
  /** Shown behind the popover and above the page while it is open — e.g. a
   *  dimming layer. Fills the viewport; a press on it closes the popover, like
   *  any press outside. Not drawn in the full-screen page, which covers the
   *  page already. */
  overlay?: ComponentChildren;
  /** A Back button in the head, before the title — for moving back between
   *  views inside the popover. In the full-screen page it replaces closing. */
  onBack?: () => void;
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'title'>;

/** `page` while the viewport is narrower than the breakpoint. A popover lives
 *  in the top layer, outside every container, so the viewport is the one box
 *  it can be measured against — hence a media query here, not a container one. */
function useMode(below: DrawerBreakpoint | false): PopoverMode {
  const query = below ? `(width < ${DRAWER_BREAKPOINTS[below]})` : null;
  const read = () => (query && typeof window.matchMedia === 'function' && window.matchMedia(query).matches ? 'page' : 'anchored');
  const [mode, setMode] = useState<PopoverMode>(read);
  useEffect(() => {
    if (!query || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const on = () => setMode(mq.matches ? 'page' : 'anchored');
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return mode;
}

export function Popover({
  triggerRef, isOpen, onOpenChange, placement, offset, crossOffset, shouldFlip, containerPadding, maxHeight, variant = 'raised', ground,
  fullscreenBelow = 'sm', title, titleIcon, centered = false, centerY = 0.5, overlay, onBack, children, ...rest
}: PopoverProps) {
  const mode = useMode(fullscreenBelow);
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef(`p${Math.random().toString(36).slice(2)}`);
  const close = () => onOpenChange(false);
  // SHOWN FROM THE REF, not an effect: a ref is set during commit, before any
  // effect, so content that focuses itself in its own layout effect (a menu
  // focusing its first item) finds the popover already displayed. Shown from
  // an effect, a child's focus() would land on a display:none element and be lost.
  const show = useCallback((el: HTMLDivElement | null) => {
    ref.current = el;
    const p = el as (HTMLDivElement & { showPopover?: () => void }) | null;
    if (p?.showPopover && !p.matches(':popover-open')) p.showPopover();
  }, []);
  // The overlay goes into the top layer FIRST, and the top layer stacks in the
  // order things were shown, so it lands behind the popover. Its ref runs
  // before the popover's because it comes first in the tree.
  const showOverlay = useCallback((el: HTMLDivElement | null) => {
    const p = el as (HTMLDivElement & { showPopover?: () => void }) | null;
    if (p?.showPopover && !p.matches(':popover-open')) p.showPopover();
  }, []);
  // The latest close, for listeners installed once per opening.
  const closeRef = useRef(close);
  closeRef.current = close;

  useLayoutEffect(() => {
    const el = ref.current;
    const trigger = triggerRef.current;
    if (!isOpen || !el) return;

    // A NAME for the dialog: the title or an aria-label when given, else the
    // trigger's own text. The trigger gets an id to be named by if it has none.
    if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') && trigger) {
      if (!trigger.id) trigger.id = `${id.current}-trigger`;
      el.setAttribute('aria-labelledby', trigger.id);
    }

    // PLACEMENT (anchored only): measure, place, write — no render per frame.
    const position = () => {
      if (mode !== 'anchored') return;
      if (centered) {
        // The middle of the viewport, and no taller than it less the padding.
        el.style.left = '0px';
        el.style.top = '0px';
        const pad = containerPadding ?? 12;
        const vw = document.documentElement.clientWidth || window.innerWidth;
        const vh = window.innerHeight;
        const width = el.offsetWidth;
        const fit = Math.max(0, Math.min(maxHeight ?? Infinity, vh - 2 * pad));
        const height = Math.min(el.scrollHeight + (el.offsetHeight - el.clientHeight), fit);
        el.style.left = `${Math.max(pad, (vw - width) / 2)}px`;
        const share = Math.min(1, Math.max(0, centerY));
        el.style.top = `${Math.max(pad, Math.min(vh - pad - height, (vh - height) * share))}px`;
        el.style.maxHeight = `${fit}px`;
        delete el.dataset.placement;
        return;
      }
      if (!trigger) return;
      const t = trigger.getBoundingClientRect();
      // Measure at the origin: a shrink-to-fit box measured where it last sat
      // (say near the right edge) is squeezed narrower than it will be once
      // moved, and would then be placed past the padding. Same frame, no paint.
      el.style.left = '0px';
      el.style.top = '0px';
      // LAYOUT size, never the bounding rect: the entrance animation scales the
      // box (0.96 -> 1), and a rect measured mid-animation is too small, so the
      // popover would be placed past the padding. offsetWidth ignores transforms.
      // Height: the content's scroll height plus the borders, whatever
      // max-height is applied now.
      const width = el.offsetWidth;
      const height = el.scrollHeight + (el.offsetHeight - el.clientHeight);
      const p = place({
        trigger: { left: t.left, top: t.top, width: t.width, height: t.height },
        popup: { width, height },
        viewport: { width: document.documentElement.clientWidth || window.innerWidth, height: window.innerHeight },
        placement, offset, crossOffset, shouldFlip, containerPadding, maxHeight,
      });
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      el.style.maxHeight = `${p.maxHeight}px`;
      el.dataset.placement = p.placement;
      el.style.setProperty('--trigger-width', `${t.width}px`);
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position);
    ro?.observe(el);
    if (trigger) ro?.observe(trigger);

    // FOCUS: in, unless the content already took it.
    if (!el.contains(document.activeElement)) {
      // The CONTENT first: the head's Back/Close come before it in the tree,
      // and opening a popover should not land on its Close button.
      const body = el.querySelector<HTMLElement>('[data-slot="body"]');
      (body?.querySelector<HTMLElement>(TAB_STOPS) ?? el.querySelector<HTMLElement>(TAB_STOPS) ?? el).focus();
    }

    // DISMISSAL: Escape, or a press anywhere but the popover and its trigger.
    // Escape closes the INNERMOST open popover only: one opened from inside
    // this one (a menu opened from a row of a menu) is drawn as a descendant
    // of it, so while it is open this one leaves Escape to it, and closes on
    // the next. Decided by nesting, not by which listener runs first.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (el.querySelector('[data-boogy="popover"]')) return;
        e.preventDefault(); closeRef.current(); return;
      }
      // Already handled inside (a menu closes on Tab rather than trapping it).
      if (e.defaultPrevented) return;
      if (e.key !== 'Tab' || !el.contains(document.activeElement)) return;
      // Focus stays inside while it is open.
      const items = Array.from(el.querySelectorAll<HTMLElement>(TAB_STOPS));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    };
    const onPress = (e: Event) => {
      const target = e.target as Node;
      if (el.contains(target) || trigger?.contains(target)) return;
      closeRef.current();
    };
    // A press inside an embedded frame (an iframe: another page) reaches that
    // page, never this document; here it shows only as this window losing
    // focus to the frame. A frame inside the popover is the popover's own; the
    // whole window losing focus (another app) leaves it open.
    let blurCheck = 0;
    const onBlur = () => {
      clearTimeout(blurCheck);
      blurCheck = window.setTimeout(() => {
        const at = document.activeElement;
        if (at instanceof HTMLIFrameElement && !el.contains(at)) closeRef.current();
      }, 0);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPress, true);
    window.addEventListener('blur', onBlur);

    // HISTORY (page only): back closes it; any other close steps back.
    let pushed = false;
    const onPop = () => {
      if (!pushed || (history.state as { boogyPopover?: string } | null)?.boogyPopover === id.current) return;
      pushed = false;
      closeRef.current();
    };
    if (mode === 'page') {
      history.pushState({ ...(history.state as object | null), boogyPopover: id.current }, '');
      pushed = true;
      window.addEventListener('popstate', onPop);
    }

    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      ro?.disconnect();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPress, true);
      window.removeEventListener('blur', onBlur);
      clearTimeout(blurCheck);
      window.removeEventListener('popstate', onPop);
      if (pushed && (history.state as { boogyPopover?: string } | null)?.boogyPopover === id.current) history.back();
      if (el.contains(document.activeElement) || document.activeElement === document.body) trigger?.focus();
    };
  }, [isOpen, mode, centered, centerY]);

  if (!isOpen) return null;
  const page = mode === 'page';
  return (
    <>
    {overlay && !page && (
      <div
        data-boogy="popover-overlay"
        ref={showOverlay}
        popover="manual"
        aria-hidden="true"
        // Neutralise the browser's own [popover] box — margin, border, padding,
        // canvas background — so what fills the viewport is the caller's
        // element and nothing of ours.
        style={{ inset: 0, width: '100%', height: '100%', maxWidth: 'none', maxHeight: 'none',
          margin: 0, padding: 0, border: 0, background: 'transparent', overflow: 'hidden' }}
      >
        {overlay}
      </div>
    )}
    <div
      {...rest}
      // A ground the caller passes (any CSS colour) is the popover's own.
      style={ground === undefined ? rest.style : { ...(rest.style as object | undefined), '--popover-ground': ground } as JSX.CSSProperties}
      {...popover({ mode, variant })}
      ref={show}
      popover="manual"
      role="dialog"
      aria-modal={page ? 'true' : undefined}
      aria-label={title ?? (rest as { 'aria-label'?: string })['aria-label']}
      tabIndex={-1}
    >
      {(page || centered || onBack) && (
        // THE HEAD — an optional Back, the title, and Close — where the popover
        // is a DIALOG: the full-screen page (Back stands in for Close), a
        // centred one, or one with a view to step back from. Anchored, it is a
        // menu off its trigger, and the title only names it.
        <div data-slot="head">
          {(page || onBack) && (
            <BackButton onClick={onBack ?? close} />
          )}
          {title && titleIcon != null && <span data-slot="title-icon" aria-hidden="true">{titleIcon}</span>}
          {title && <span data-slot="title">{title}</span>}
          {!page && (
            <Button variant="quiet" shape="icon" label="Close" onClick={close}>
              <Glyph shape="close" />
            </Button>
          )}
        </div>
      )}
      <div data-slot="body">{children}</div>
    </div>
    </>
  );
}
