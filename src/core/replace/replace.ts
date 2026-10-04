/**
 * `replace`: serve a reference string with N frames under one policy, one phase per
 * reference, with an event for each thing that happens (07 §1):
 *
 * - the page is resident → `hit`;
 * - it isn't → `fault`, then, if every frame is full, (Clock: `scan` per use bit cleared)
 *   → `victim` (with the reason) → `evict`; then `load`.
 *
 * `serve` is the one place a reference is decided; `replace` turns its outcome into
 * events and `countFaults` (the curve's fast path) only counts. Pure and deterministic.
 */

import { createRun } from '../events/builder';
import type { SimResult } from '../sim/result';
import type { ReplCounters, ReplEvent, ReplEventKind, ReplSnapshot } from './events';
import { POLICY_NAMES, type Policy, type ReplInput } from './input';
import {
  copyMemory,
  emptyMemory,
  frameOf,
  nextUse,
  POLICY_IMPLS,
  type Memory,
  type VictimChoice,
} from './policies';

export type ReplRun = SimResult<ReplEvent>;

/** What serving one reference did. */
export interface Outcome {
  page: number;
  hit: boolean;
  /** A fault on the page's first reference. */
  cold: boolean;
  /** Where the page is after the reference. */
  frame: number;
  /** Set when every frame was full and a page had to go. */
  victim: VictimChoice | null;
  /** Memory after the reference. */
  memory: Memory;
}

/** Bookkeeping shared by every policy for a hit on `frame` at reference `index`. */
function touch(memory: Memory, frame: number, index: number): Memory {
  const next = copyMemory(memory);
  next.lastUse[frame] = index;
  next.useBits[frame] = 1;
  return next;
}

function evict(memory: Memory, frame: number): Memory {
  const next = copyMemory(memory);
  next.frames[frame] = null;
  next.loadedAt[frame] = null;
  next.lastUse[frame] = null;
  next.useBits[frame] = 0;
  return next;
}

/** Load `page` into empty `frame`: use bit 1, and the hand moves to the next frame. */
function load(memory: Memory, frame: number, page: number, index: number): Memory {
  const next = copyMemory(memory);
  next.frames[frame] = page;
  next.loadedAt[frame] = index;
  next.lastUse[frame] = index;
  next.useBits[frame] = 1;
  next.hand = (frame + 1) % next.frames.length;
  return next;
}

/** Serve reference `index` of `refString`. */
export function serve(
  policy: Policy,
  memory: Memory,
  refString: readonly number[],
  index: number,
): Outcome {
  const page = refString[index]!;
  const resident = frameOf(memory, page);
  if (resident !== -1) {
    return {
      page,
      hit: true,
      cold: false,
      frame: resident,
      victim: null,
      memory: touch(memory, resident, index),
    };
  }
  const cold = !refString.slice(0, index).includes(page);
  const empty = memory.frames.indexOf(null);
  if (empty !== -1) {
    return {
      page,
      hit: false,
      cold,
      frame: empty,
      victim: null,
      memory: load(memory, empty, page, index),
    };
  }
  const victim = POLICY_IMPLS[policy].chooseVictim(memory, { refString, index });
  return {
    page,
    hit: false,
    cold,
    frame: victim.frame,
    victim,
    memory: load(evict(victim.memory, victim.frame), victim.frame, page, index),
  };
}

/** Hits, faults and cold faults, with no events. */
export function countFaults(
  refString: readonly number[],
  frames: number,
  policy: Policy,
): ReplCounters {
  let memory = emptyMemory(frames);
  const counters: ReplCounters = { hits: 0, faults: 0, cold: 0 };
  refString.forEach((_, index) => {
    const outcome = serve(policy, memory, refString, index);
    memory = outcome.memory;
    if (outcome.hit) counters.hits += 1;
    else {
      counters.faults += 1;
      if (outcome.cold) counters.cold += 1;
    }
  });
  return counters;
}

function snapshot(
  policy: Policy,
  memory: Memory,
  refString: readonly number[],
  index: number,
  counters: ReplCounters,
): ReplSnapshot {
  const base: ReplSnapshot = { index, frames: [...memory.frames], ...counters };
  switch (policy) {
    case 'fifo':
      return {
        ...base,
        queue: memory.frames
          .map((page, f) => ({ page, at: memory.loadedAt[f] }))
          .filter((x): x is { page: number; at: number } => x.page !== null)
          .sort((a, b) => a.at - b.at)
          .map((x) => x.page),
      };
    case 'lru':
      return { ...base, lastUse: [...memory.lastUse] };
    case 'opt':
      return {
        ...base,
        nextUse: memory.frames.map((page) =>
          page === null ? null : nextUse(refString, page, index),
        ),
      };
    case 'clock':
      return { ...base, useBits: [...memory.useBits], hand: memory.hand };
  }
}

function hitDetail(policy: Policy, index: number, before: Memory, frame: number): string {
  switch (policy) {
    case 'fifo':
      return 'FIFO changes nothing on a hit: the page keeps its place in the queue.';
    case 'lru':
      return `Its last use moves to reference ${index + 1}, so it is now the most recently used page.`;
    case 'opt':
      return 'OPT keeps no history; it only looks at what comes next.';
    case 'clock':
      return before.useBits[frame] === 1
        ? 'Its use bit is already 1. The hand does not move on a hit.'
        : 'Its use bit is set to 1. The hand does not move on a hit.';
  }
}

/** Run `refString` with `frames` frames under `policy`. Expects valid input. */
export function replace(
  refString: readonly number[],
  frames: number,
  policy: Policy,
): ReplRun {
  const run = createRun<ReplEvent>({ unit: 'step' });
  const counters: ReplCounters = { hits: 0, faults: 0, cold: 0 };
  let memory = emptyMemory(frames);
  const name = POLICY_NAMES[policy];

  refString.forEach((page, index) => {
    const phaseId = `ref-${index}`;
    let n = 0;
    const emit = (
      kind: ReplEventKind,
      state: Memory,
      citation: string,
      label: string,
      extra: Partial<Pick<ReplEvent, 'frame' | 'cold' | 'evicted' | 'detail'>> & {
        page?: number;
      } = {},
    ) => {
      run.emit({
        kind,
        id: `repl.${phaseId}.${n++}`,
        label,
        citation,
        page,
        ...extra,
        state: snapshot(policy, state, refString, index, counters),
      });
      run.advance();
    };

    run.phase(
      phaseId,
      `Ref ${index + 1}: page ${page}`,
      `Reference ${index + 1} of ${refString.length}: page ${page}.`,
      `Is page ${page} already in memory? If not, which page makes room for it?`,
    );

    const before = memory;
    const outcome = serve(policy, memory, refString, index);
    memory = outcome.memory;

    if (outcome.hit) {
      counters.hits += 1;
      emit(
        'repl.hit',
        memory,
        'ostep.22.1',
        `Hit: page ${page} is in frame ${outcome.frame}.`,
        {
          frame: outcome.frame,
          detail: hitDetail(policy, index, before, outcome.frame),
        },
      );
      return;
    }

    counters.faults += 1;
    if (outcome.cold) counters.cold += 1;
    const full = outcome.victim !== null;
    emit(
      'repl.fault',
      before,
      outcome.cold ? 'ostep.22.2' : 'osc10.10.4.1',
      outcome.cold
        ? `Fault: page ${page} is not in memory. It has never been referenced, so this is a cold (compulsory) miss.`
        : `Fault: page ${page} is not in memory. It was here before and was evicted, so this is a capacity miss.`,
      {
        cold: outcome.cold,
        detail: full
          ? `All ${frames} frames are full, so ${name} must choose a page to evict.`
          : `Frame ${outcome.frame} is empty, so the page goes there and nothing is evicted.`,
      },
    );

    if (outcome.victim) {
      const { victim } = outcome;
      for (const scan of victim.scans) {
        emit(
          'repl.scan',
          scan.memory,
          'osc10.10.4.5.2',
          `Clear use bit of frame ${scan.frame} (page ${scan.page}), move hand to frame ${scan.memory.hand}.`,
          {
            page: scan.page,
            frame: scan.frame,
            detail: `Page ${scan.page} was used since the hand last passed, so it gets a second chance.`,
          },
        );
      }
      const victimPage = victim.memory.frames[victim.frame]!;
      emit(
        'repl.victim',
        victim.memory,
        victim.citation,
        `Evict ${victimPage}: ${victim.reason}.`,
        {
          page: victimPage,
          frame: victim.frame,
          detail: victim.detail,
        },
      );
      emit(
        'repl.evict',
        evict(victim.memory, victim.frame),
        'osc10.10.4.1',
        `Page ${victimPage} leaves frame ${victim.frame}.`,
        {
          page: victimPage,
          frame: victim.frame,
          detail:
            'A dirty page would be written back to disk first; this model does not track dirty bits.',
        },
      );
    }

    const loadDetail =
      policy === 'clock'
        ? `Its use bit starts at 1 and the hand moves to frame ${memory.hand}.`
        : policy === 'fifo'
          ? 'It joins the back of the FIFO queue.'
          : policy === 'lru'
            ? 'It is now the most recently used page.'
            : 'OPT will judge it by when it is next needed.';
    emit(
      'repl.load',
      memory,
      'osc10.10.4.1',
      outcome.victim
        ? `Load page ${page} into frame ${outcome.frame}, replacing page ${outcome.victim.memory.frames[outcome.frame]}.`
        : `Load page ${page} into empty frame ${outcome.frame}.`,
      {
        frame: outcome.frame,
        ...(outcome.victim
          ? { evicted: outcome.victim.memory.frames[outcome.frame]! }
          : {}),
        detail: loadDetail,
      },
    );
  });

  return run.finish();
}

/** `replace` on a whole input. */
export function runReplace(input: ReplInput): ReplRun {
  return replace(input.refString, input.frames, input.policy);
}

/** What each reference did, read off the run: one entry per reference, in order. */
export interface RefResult {
  index: number;
  page: number;
  hit: boolean;
  cold: boolean;
  /** Where the page is after the reference. */
  frame: number;
  /** The page it replaced, on a fault into a full memory. */
  evicted: number | null;
  /** Frames after the reference. */
  frames: (number | null)[];
}

export function refResults(run: ReplRun): RefResult[] {
  const results: RefResult[] = [];
  let cold = false;
  for (const e of run.events) {
    if (e.kind === 'repl.fault') cold = e.cold === true;
    if (e.kind !== 'repl.hit' && e.kind !== 'repl.load') continue;
    results.push({
      index: e.state.index,
      page: e.page,
      hit: e.kind === 'repl.hit',
      cold: e.kind === 'repl.load' && cold,
      frame: e.frame!,
      evicted: e.evicted ?? null,
      frames: [...e.state.frames],
    });
  }
  return results;
}

/** The counters after the last event (all zero for an empty run). */
export function totals(run: ReplRun): ReplCounters {
  const last = run.events.at(-1);
  if (!last) return { hits: 0, faults: 0, cold: 0 };
  const { hits, faults, cold } = last.state;
  return { hits, faults, cold };
}
