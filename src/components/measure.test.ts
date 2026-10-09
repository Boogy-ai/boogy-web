import { describe, it, expect, afterEach } from 'vitest';
import { flushRounds, measurePadding, runRounds, setFrameScheduler, type RoundJob } from './measure';

function recording(name: string, rounds: number, log: string[], el?: Element): RoundJob {
  let left = rounds;
  return {
    el,
    start: () => { log.push(`start ${name}`); left = rounds; },
    write: () => { log.push(`write ${name}`); },
    read: () => { log.push(`read ${name}`); left -= 1; return left === 0; },
    finish: () => { log.push(`finish ${name}`); },
  };
}

/** An element holding another, as a grid holds a cell's text. */
function nested(): { outer: HTMLElement; inner: HTMLElement } {
  const outer = document.createElement('div');
  const inner = document.createElement('div');
  outer.append(inner);
  return { outer, inner };
}

let restore: ((run: () => void) => void) | null = null;
afterEach(() => { if (restore) setFrameScheduler(restore); restore = null; });

describe('runRounds', () => {
  it('batches every job: all writes of a round before any read, and a job finishes as soon as it is done', () => {
    const log: string[] = [];
    let frames = 0;
    restore = setFrameScheduler(() => { frames += 1; }); // queue without running
    runRounds(recording('a', 2, log));
    runRounds(recording('b', 1, log));
    expect(frames).toBe(1);
    flushRounds();
    expect(log).toEqual([
      'start a', 'start b',
      'write a', 'write b', 'read a', 'read b', 'finish b',
      'write a', 'read a', 'finish a',
    ]);
  });

  it('runs a job queued twice in one frame once', () => {
    const log: string[] = [];
    restore = setFrameScheduler(() => {});
    const job = recording('a', 1, log);
    runRounds(job);
    runRounds(job);
    flushRounds();
    expect(log.filter((l) => l === 'finish a')).toHaveLength(1);
  });

  it("a job inside another job's element waits for it, so every read it makes sees that job's result", () => {
    restore = setFrameScheduler(() => {});
    const { outer, inner } = nested();
    const log: string[] = [];
    let published = false;
    const grid: RoundJob = {
      el: outer,
      start: () => { log.push('start grid'); },
      write: () => { log.push('write grid'); },
      read: () => { log.push('read grid'); return true; },
      finish: () => { log.push('finish grid'); published = true; },
    };
    const seen: boolean[] = [];
    let left = 3;
    const fit: RoundJob = {
      el: inner,
      start: () => { log.push('start fit'); left = 3; },
      write: () => { log.push('write fit'); },
      read: () => { log.push('read fit'); seen.push(published); left -= 1; return left === 0; },
      finish: () => { log.push('finish fit'); },
    };
    // The inner job is queued first, as a framework runs a child's effects
    // before its parent's: the order comes from the elements, not the queue.
    runRounds(fit);
    runRounds(grid);
    flushRounds();
    expect(seen).toEqual([true, true, true]);
    expect(log).toEqual([
      'start grid', 'write grid', 'read grid', 'finish grid',
      'start fit', 'write fit', 'read fit', 'write fit', 'read fit', 'write fit', 'read fit', 'finish fit',
    ]);
  });

  it('a large batch costs work in proportion to its jobs: telling which waits for which is no pairwise scan', () => {
    restore = setFrameScheduler(() => {});
    // Every step through the tree that working out containment can take: a
    // `contains` call, or a step to a parent.
    let steps = 0;
    const undo: (() => void)[] = [];
    for (const name of ['contains', 'parentElement', 'parentNode']) {
      let owner: object | null = document.createElement('div');
      while (owner && !Object.getOwnPropertyDescriptor(owner, name)) owner = Object.getPrototypeOf(owner);
      const d = Object.getOwnPropertyDescriptor(owner!, name)!;
      const counted: PropertyDescriptor = d.get
        ? { ...d, get(this: Node) { steps += 1; return d.get!.call(this); } }
        : { ...d, value(this: Node, ...a: unknown[]) { steps += 1; return (d.value as (...x: unknown[]) => unknown).apply(this, a); } };
      Object.defineProperty(owner!, name, counted);
      undo.push(() => Object.defineProperty(owner!, name, d));
    }
    const box = document.createElement('div');
    document.body.append(box);
    const n = 1000;
    const log: string[] = [];
    try {
      for (let i = 0; i < n; i++) {
        const el = document.createElement('div');
        box.append(el);
        runRounds(recording(`j${i}`, 1, log, el));
      }
      steps = 0;
      flushRounds();
    } finally {
      undo.forEach((u) => u());
      box.remove();
    }
    expect(log.filter((l) => l.startsWith('finish'))).toHaveLength(n);
    // A pairwise scan takes n² = 1,000,000 steps; a walk up from each
    // element takes a handful each.
    expect(steps).toBeLessThan(20 * n);
  });

  it('a job still waiting at the round ceiling is queued for the next frame, not dropped', () => {
    let frames = 0;
    restore = setFrameScheduler(() => { frames += 1; });
    const { outer, inner } = nested();
    const log: string[] = [];
    const endless: RoundJob = {
      el: outer,
      start: () => {},
      write: () => {},
      read: () => false,
      finish: () => { log.push('finish endless'); },
    };
    runRounds(recording('held', 1, log, inner));
    runRounds(endless);
    flushRounds();
    expect(log).toEqual(['finish endless']);
    expect(frames).toBe(2);
    flushRounds();
    expect(log).toEqual(['finish endless', 'start held', 'write held', 'read held', 'finish held']);
  });
});

describe('settling, once the whole batch has finished', () => {
  /** A one-round job whose `settle` answers from `answers`, in turn. */
  function settling(name: string, log: string[], answers: boolean[], el?: Element): RoundJob {
    return {
      ...recording(name, 1, log, el),
      settle: () => { log.push(`settle ${name}`); return answers.shift() ?? true; },
    };
  }

  it('a job settles only after every job in its batch has finished, not when it alone is done', () => {
    restore = setFrameScheduler(() => {});
    const log: string[] = [];
    runRounds(settling('quick', log, [true]));
    runRounds(recording('slow', 3, log));
    flushRounds();
    expect(log.indexOf('settle quick')).toBeGreaterThan(log.indexOf('finish slow'));
  });

  it('a job whose result no longer holds runs again next frame, and joins only once every other job there has finished', () => {
    let frames = 0;
    restore = setFrameScheduler(() => { frames += 1; });
    const log: string[] = [];
    runRounds(settling('moved', log, [false, true]));
    flushRounds();
    expect(log).toEqual(['start moved', 'write moved', 'read moved', 'finish moved', 'settle moved']);
    expect(frames).toBe(2);
    log.length = 0;
    runRounds(recording('other', 2, log));
    flushRounds();
    expect(log).toEqual([
      'start other', 'write other', 'read other', 'write other', 'read other', 'finish other',
      'start moved', 'write moved', 'read moved', 'finish moved', 'settle moved',
    ]);
    // Settled: nothing is queued again.
    expect(frames).toBe(2);
  });

  it('each job settles alone, a round at a time until it answers, while every other job holds its result', () => {
    restore = setFrameScheduler(() => {});
    const log: string[] = [];
    // `a` answers on its second settling round, `b` on its first.
    const twoStep = (name: string, answers: (boolean | null)[]): RoundJob => ({
      ...recording(name, 1, log),
      settleWrite: () => { log.push(`settle-write ${name}`); },
      settle: () => { log.push(`settle ${name}`); return answers.length > 0 ? answers.shift()! : true; },
    });
    runRounds(twoStep('a', [null, true]));
    runRounds(twoStep('b', [true]));
    flushRounds();
    expect(log.slice(log.indexOf('finish b') + 1)).toEqual([
      'settle-write a', 'settle a', 'settle-write a', 'settle a',
      'settle-write b', 'settle b',
    ]);
  });

  it('a job whose result never holds runs again three times, then is kept as it is', () => {
    let frames = 0;
    restore = setFrameScheduler(() => { frames += 1; });
    const log: string[] = [];
    runRounds(settling('restless', log, Array(10).fill(false)));
    for (let i = 0; i < 10; i++) flushRounds();
    expect(log.filter((l) => l === 'settle restless')).toHaveLength(4);
    expect(frames).toBe(4);
  });
});

describe('measurePadding', () => {
  it("reads an element's computed padding in pixels, each axis summed", () => {
    const el = document.createElement('div');
    el.style.padding = '1px 0.5rem 3px 4px';
    document.body.append(el);
    expect(measurePadding(el)).toEqual({ inline: 8 + 4, block: 1 + 3 });
    el.remove();
  });
});
