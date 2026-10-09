// Measuring, shared by every primitive that sizes itself from its box.
//
// There is one ResizeObserver for the whole page, and one batch per animation
// frame. A batch runs every pending job in rounds: all of a round's writes,
// then all of its reads. A page full of fitted elements therefore forces one
// layout per round, never one per element (and, as each job settles, one per
// settling round of that job).
//
// A job finishes as soon as its read reports done, so the rounds after it see
// its result. A job whose element sits inside another queued job's element
// joins only once that job has finished: an outer box (a grid's cells) settles
// before anything it holds (the text fitted in a cell) is measured. A job
// whose result moves what its element holds while the element keeps its size
// (a grid's new shape) has every element measured inside it join the batch.
//
// Jobs side by side are measured together, so one can read a layout another's
// probes are still moving (a fitted heading resizing the grid below it). Once
// every job in the batch has finished, each one SETTLES: alone, while every
// other job holds its result, it checks that result in the layout the batch
// left. One whose result no longer holds runs again in the next frame, and
// joins that batch only once every other job in it has finished, so it
// measures a layout nothing else is moving.

/** One element's measuring work. `read` reports whether the job is done. */
export interface RoundJob {
  /** The element whose box the job measures. Without one, the job never
   *  waits and never holds another job back. */
  readonly el?: Element;
  start(): void;
  write(): void;
  read(): boolean;
  finish(): void;
  /** Once every job in the batch has finished, the job checks its result in
   *  the layout they left, alone and a round at a time: `settleWrite`, then
   *  `settle`, until `settle` answers whether the result still holds instead
   *  of `null` (one more round). It ends on its own result written, so the
   *  next job settles against it. `false` runs the job again. */
  settleWrite?(): void;
  settle?(): boolean | null;
}

type FrameScheduler = (run: () => void) => void;

/** A ceiling on rounds, so a job that never reports done cannot hang the frame. */
const MAX_ROUNDS = 16;

/** How many passes in a row a job may find its result moved under it before
 *  that result is kept as it is: a layout that moves under every pass (two
 *  boxes each sizing the other) would otherwise be measured every frame. */
const MAX_UNSETTLED = 3;

let schedule: FrameScheduler = (run) => {
  requestAnimationFrame(() => run());
};
const pending = new Set<RoundJob>();
let queued = false;
/** A batch is measuring: a job queued now joins it. */
let measuring = false;
/** Jobs running again after a moved layout: each joins its batch last. */
const deferred = new WeakSet<RoundJob>();
/** Passes in a row whose result did not hold, per job. */
const unsettled = new WeakMap<RoundJob, number>();

/** Queue `job` for the next frame's batch, or, queued while a batch is
 *  measuring, for that batch. A job queued twice runs once. */
export function runRounds(job: RoundJob): void {
  pending.add(job);
  if (queued || measuring) return;
  queued = true;
  schedule(flushRounds);
}

/** Whether a strict ancestor of `el` is one of `among`. */
function insideAny(el: Element | undefined, among: ReadonlySet<Element>): boolean {
  for (let a = el?.parentElement; a; a = a.parentElement) if (among.has(a)) return true;
  return false;
}

/** The waiting jobs no unfinished job holds back. An unfinished job holds
 *  back every job whose element sits inside its own; and a job running again
 *  after a moved layout is held back by any unfinished job not doing the same
 *  and not inside its element (which waits for it in turn). Worked out by
 *  walking up from each element, never by comparing every pair: a page's
 *  first batch holds every measured element on it. */
function joinable(waiting: ReadonlySet<RoundJob>, running: ReadonlySet<RoundJob>): RoundJob[] {
  const unfinished = [...running, ...waiting];
  const holders = new Set<Element>();
  for (const j of unfinished) if (j.el) holders.add(j.el);
  // Per element of a job running again: the unfinished jobs not running
  // again that sit inside it, against how many there are in all.
  const within = new Map<Element, number>();
  for (const j of waiting) if (deferred.has(j) && j.el) within.set(j.el, 0);
  let others = 0;
  if ([...waiting].some((j) => deferred.has(j))) {
    for (const o of unfinished) {
      if (deferred.has(o)) continue;
      others += 1;
      for (let a = o.el?.parentElement; a; a = a.parentElement) {
        const n = within.get(a);
        if (n !== undefined) within.set(a, n + 1);
      }
    }
  }
  return [...waiting].filter((j) => {
    if (insideAny(j.el, holders)) return false;
    return !deferred.has(j) || others === (j.el ? within.get(j.el)! : 0);
  });
}

/** Run every queued job to completion. Each round, the jobs queued since the
 *  last join the waiting, the jobs nothing holds back start, every running job
 *  writes, every running job reads, and each job whose read reports done
 *  finishes. A job still running at the ceiling finishes there; one still
 *  waiting is queued for the next frame. Then every finished job settles, and
 *  one whose result no longer holds is queued again. */
export function flushRounds(): void {
  settleRounds(measureRounds());
}

/** The measuring rounds. Returns the jobs that finished. */
function measureRounds(): RoundJob[] {
  queued = false;
  measuring = true;
  const waiting = new Set<RoundJob>();
  const running = new Set<RoundJob>();
  const finished = new Set<RoundJob>();
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      for (const j of pending) if (!running.has(j)) waiting.add(j);
      pending.clear();
      if (running.size === 0 && waiting.size === 0) break;
      for (const j of joinable(waiting, running)) {
        waiting.delete(j);
        deferred.delete(j);
        j.start();
        running.add(j);
      }
      for (const j of running) j.write();
      const done = [...running].filter((j) => j.read());
      for (const j of done) {
        running.delete(j);
        j.finish();
        finished.add(j);
      }
    }
    for (const j of running) {
      j.finish();
      finished.add(j);
    }
  } finally {
    measuring = false;
  }
  for (const j of waiting) pending.add(j);
  if (pending.size > 0 && !queued) {
    queued = true;
    schedule(flushRounds);
  }
  return [...finished];
}

/** Measure again every element observed inside `el`, in the batch measuring
 *  now (or else the next): a result of `el`'s moved what it holds while `el`
 *  kept its size, so no resize would say so before the frame is drawn. */
export function remeasureWithin(el: Element): void {
  el.querySelectorAll('*').forEach((inner) => handlers.get(inner)?.());
}

/** The settling rounds, for every finished job that settles, one job at a
 *  time: a check made while a neighbour tries a size of its own would answer
 *  for a layout that is not the one left on the page. A job whose result no
 *  longer holds is queued again, to join its next batch last, unless it has
 *  already failed to hold MAX_UNSETTLED passes in a row. */
function settleRounds(finished: RoundJob[]): void {
  const moved: RoundJob[] = [];
  for (const j of finished) {
    if (!j.settle) continue;
    let answer: boolean | null = null;
    for (let round = 0; round < MAX_ROUNDS && answer === null; round++) {
      j.settleWrite?.();
      answer = j.settle();
    }
    if (answer === false) moved.push(j);
    else unsettled.delete(j);
  }
  for (const j of moved) {
    const passes = (unsettled.get(j) ?? 0) + 1;
    if (passes > MAX_UNSETTLED) {
      unsettled.delete(j);
      continue;
    }
    unsettled.set(j, passes);
    deferred.add(j);
    runRounds(j);
  }
}

/** Replace the frame scheduler (a test runs the batch by hand). Returns the
 *  previous one. */
export function setFrameScheduler(next: FrameScheduler): FrameScheduler {
  const previous = schedule;
  schedule = next;
  return previous;
}

const handlers = new WeakMap<Element, () => void>();
let observer: ResizeObserver | null = null;

/** Call `handler` now, and again whenever `el`'s box changes size, through
 *  the page's one ResizeObserver. Returns the function that stops it. */
export function observeSize(el: Element, handler: () => void): () => void {
  handler();
  if (typeof ResizeObserver === 'undefined') return () => {};
  observer ??= new ResizeObserver((entries) => {
    for (const entry of entries) handlers.get(entry.target)?.();
  });
  handlers.set(el, handler);
  observer.observe(el);
  return () => {
    observer?.unobserve(el);
    handlers.delete(el);
  };
}

/** Whether `style` sets its lines down the page: its inline axis is vertical. */
function vertical(style: CSSStyleDeclaration): boolean {
  return /^(vertical|sideways)/.test(style.writingMode);
}

const px = (v: string) => Number.parseFloat(v) || 0;

/** `el`'s padding in pixels, each axis summed, as laid out: computed, so a
 *  transform does not scale it. The axes are `el`'s writing mode's: inline is
 *  left plus right in horizontal text, top plus bottom in vertical text. */
export function measurePadding(el: Element): { inline: number; block: number } {
  const style = getComputedStyle(el);
  const across = px(style.paddingLeft) + px(style.paddingRight);
  const down = px(style.paddingTop) + px(style.paddingBottom);
  return vertical(style) ? { inline: down, block: across } : { inline: across, block: down };
}

/** `el`'s content box in pixels, each axis, as laid out: inside the border
 *  and any scrollbar, less the padding, and untransformed. To the fraction of
 *  a pixel: the client size is rounded to a whole one, which at a threshold
 *  is the difference. The axes are `el`'s writing mode's, as for
 *  `measurePadding`. */
export function measureContentBox(el: Element): { inline: number; block: number } {
  const style = getComputedStyle(el);
  const borderBox = style.boxSizing === 'border-box';
  const axis = (used: string, client: number, padding: number, border: number) => {
    const size = Number.parseFloat(used);
    // `auto`: a box with no used size to read (an inline element).
    if (!Number.isFinite(size)) return Math.max(0, client - padding);
    // The used size is the content box, or the border box under border-box
    // sizing, and neither leaves a scrollbar out. A scrollbar is what the
    // padding box holds beyond the client size: whole pixels, so rounding it
    // takes out the client size's own rounding.
    const paddingBox = borderBox ? size - border : size + padding;
    const scrollbar = Math.max(0, Math.round(paddingBox - client));
    return Math.max(0, paddingBox - scrollbar - padding);
  };
  const width = axis(style.width, el.clientWidth, px(style.paddingLeft) + px(style.paddingRight), px(style.borderLeftWidth) + px(style.borderRightWidth));
  const height = axis(style.height, el.clientHeight, px(style.paddingTop) + px(style.paddingBottom), px(style.borderTopWidth) + px(style.borderBottomWidth));
  return vertical(style) ? { inline: height, block: width } : { inline: width, block: height };
}

/** A CSS length (any unit, with `var()` and container units resolved where
 *  `host` is) in pixels, as laid out: a transform on `host` does not scale it.
 *  On a host that is not laid out (`display: none`, or out of the document) a
 *  length that needs a box, such as a percentage, has none to resolve
 *  against, and is 0. */
export function resolveLength(host: HTMLElement, length: string): number {
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.height = '0';
  probe.style.width = length;
  host.appendChild(probe);
  // Laid out, the width is the used one, in pixels. Not laid out, it is the
  // computed one, where a percentage is still one ("50%").
  const width = getComputedStyle(probe).width;
  probe.remove();
  return width.endsWith('px') ? Number.parseFloat(width) || 0 : 0;
}
