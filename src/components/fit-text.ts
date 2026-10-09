// FitText: text at the largest font size in [min, max] at which it fits its
// box. `min` and `max` are CSS lengths. The size is
// `min + (max - min) * --fit`, and the fit is a bisection on --fit over 0..1:
// the maximum is tried first, then FIT_ROUNDS - 1 midpoints. Every instance
// on a page is fitted in the shared per-frame batch (see measure.ts).

import { observeSize, runRounds, type RoundJob } from './measure';
import { onZoomChange } from '../layout/zoom';

export const FIT_ROUNDS = 8;

export interface FitTextAttrs {
  'data-boogy': 'fit-text';
}

export function fitText(): FitTextAttrs {
  return { 'data-boogy': 'fit-text' };
}

export function fitTextVars(min: string, max: string): { '--fit-min': string; '--fit-max': string } {
  return { '--fit-min': min, '--fit-max': max };
}

export interface FitState {
  lo: number;
  hi: number;
  round: number;
  done: boolean;
}

export function fitStart(): FitState {
  return { lo: 0, hi: 1, round: 0, done: false };
}

/** The factor to try this round: the maximum first, then the midpoint. */
export function fitProbe(s: FitState): number {
  return s.round === 0 ? 1 : (s.lo + s.hi) / 2;
}

export function fitNext(s: FitState, fits: boolean): FitState {
  const round = s.round + 1;
  if (s.round === 0) {
    return fits ? { lo: 1, hi: 1, round, done: true } : { lo: 0, hi: 1, round, done: round >= FIT_ROUNDS };
  }
  const probe = fitProbe(s);
  const next = fits ? { lo: probe, hi: s.hi } : { lo: s.lo, hi: probe };
  return { ...next, round, done: round >= FIT_ROUNDS };
}

/** The factor to keep: the largest seen to fit, or 0 when none did. The box
 *  then overflows, and the page decides how (scroll, fade). */
export function fitResult(s: FitState): number {
  return s.lo;
}

/** Whether `el`'s content fits its box, to the pixel. Measured with every
 *  word whole, a word wider than the box spills sideways, so it does not. */
function fits(el: HTMLElement): boolean {
  return el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1;
}

/** How many whole lines `el`'s box shows, at least one. */
function wholeLines(el: HTMLElement): number {
  const style = getComputedStyle(el);
  const line = Number.parseFloat(style.lineHeight) || (Number.parseFloat(style.fontSize) || 16) * 1.2;
  return Math.max(1, Math.floor((el.clientHeight + 1) / line));
}

export interface FitHandle {
  refit(): void;
  detach(): void;
}

export interface FitTextOptions {
  /** Texts attached under one name share one fit factor: the largest at which
   *  every one of them fits. With equal bounds they come out at equal sizes, so
   *  a grid of labels reads at one size; with different bounds each is placed
   *  between its own bounds by the same factor. */
  group?: string;
}

/** The texts fitted together, and their one measuring job. */
interface FitSet {
  members: Set<HTMLElement>;
  job: RoundJob;
}

const named = new Map<string, FitSet>();

/** One bisection on a factor every member shares, kept once it is done (or
 *  the batch's ceiling cuts it short). Then, once the whole batch has finished,
 *  it settles in two rounds, re-measuring the two factors the bisection
 *  decided between:
 *  1. the smallest seen NOT to fit, if any: still too big for some member?
 *  2. the kept one, the largest seen to fit: each member that overflows there
 *     says so (`data-overflow`) and how many whole lines its box shows
 *     (`--fit-lines`), so the page can end it on an ellipsis or scroll it.
 *  An answer that differs from the bisection's own means it was measured in a
 *  layout the batch has since moved (a neighbour's size changing this box),
 *  and the set is fitted again. Only at the minimum does an overflow stand. */
function fitSet(): FitSet {
  const members = new Set<HTMLElement>();
  let state = fitStart();
  /** Settling: re-measuring the factor above the kept one, then the kept one. */
  let checking: 'above' | 'kept' = 'kept';
  let tooBigAbove = true;
  const each = (f: (el: HTMLElement) => void) => members.forEach(f);
  const allFit = () => {
    let all = true;
    each((el) => { all = all && fits(el); });
    return all;
  };
  const setFactor = (f: number) => {
    const v = String(f);
    each((el) => el.style.setProperty('--fit', v));
  };
  const job: RoundJob = {
    // The first member: a box that encloses it (a grid's cells) settles first.
    get el() {
      return members.values().next().value;
    },
    start: () => {
      state = fitStart();
      // Measured unclamped, and with every word whole: a clamp left from the
      // last fit would shorten the box, and an overflow mark lets a word break
      // (the sheet's rule), so a word wider than the box would seem to fit.
      each((el) => {
        el.style.removeProperty('--fit-lines');
        delete el.dataset.overflow;
      });
    },
    write: () => setFactor(fitProbe(state)),
    read: () => {
      state = fitNext(state, allFit());
      return state.done;
    },
    finish: () => {
      setFactor(fitResult(state));
      // Nothing above the kept factor was measured when it is the maximum.
      checking = fitResult(state) < 1 ? 'above' : 'kept';
      tooBigAbove = true;
    },
    settleWrite: () => setFactor(checking === 'above' ? state.hi : fitResult(state)),
    settle: () => {
      if (checking === 'above') {
        tooBigAbove = !allFit();
        checking = 'kept';
        return null;
      }
      const kept = fitResult(state);
      // Every member measured before any is marked: a mark lets its words
      // break, which changes its layout.
      const over = new Map<HTMLElement, boolean>();
      each((el) => over.set(el, !fits(el)));
      let fitsKept = true;
      over.forEach((o, el) => {
        if (o) fitsKept = false;
        if (o) el.style.setProperty('--fit-lines', String(wholeLines(el)));
        else el.style.removeProperty('--fit-lines');
        el.dataset.overflow = String(o);
      });
      return tooBigAbove && (fitsKept || kept === 0);
    },
  };
  return { members, job };
}

/** What runs when a web font finishes loading, through one listener. */
const onFontLoads = new Set<() => void>();
let fontsHeard = false;

/** Call `f` whenever a web font finishes loading. A page lays its text out in
 *  a fallback face and swaps to the web font when it arrives (font-display:
 *  swap), which changes the text's size without resizing its box. Returns the
 *  function that stops it. */
function onFontLoad(f: () => void): () => void {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts || typeof fonts.addEventListener !== 'function') return () => {};
  if (!fontsHeard) {
    fontsHeard = true;
    fonts.addEventListener('loadingdone', () => onFontLoads.forEach((g) => g()));
  }
  onFontLoads.add(f);
  return () => onFontLoads.delete(f);
}

/** Keep `el` fitted while it is in the page: on every resize, on every zoom
 *  change, once each web font arrives, and on `refit()` when its text
 *  changes. With a `group`, it shares one size with the others attached
 *  under that name. */
export function attachFitText(el: HTMLElement, opts: FitTextOptions = {}): FitHandle {
  const set = opts.group ? (named.get(opts.group) ?? fitSet()) : fitSet();
  if (opts.group) named.set(opts.group, set);
  set.members.add(el);
  const stop = observeSize(el, () => runRounds(set.job));
  // The zoom scales the unit, and every length written in it: bounds in the
  // size tokens (or multiplied by --u-zoom) move while the box need not
  // resize, so nothing else would fit the text again.
  const offZoom = onZoomChange(() => runRounds(set.job));
  // Fitted in the fallback face, a text keeps that size once its own face
  // swaps in, unless it is fitted again: too small, or, for a face set tight,
  // stuck at its minimum as overflowing.
  const offFonts = onFontLoad(() => runRounds(set.job));
  return {
    refit: () => runRounds(set.job),
    detach: () => {
      stop();
      offZoom();
      offFonts();
      set.members.delete(el);
      if (set.members.size === 0) {
        if (opts.group && named.get(opts.group) === set) named.delete(opts.group);
      } else {
        runRounds(set.job);
      }
    },
  };
}
