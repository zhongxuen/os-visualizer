/**
 * Turning a replacement run into what the shared blocks draw. Pure functions, no React:
 * the module renders the core's decisions, it never makes its own.
 */

import type { FrameColumn } from '@/components/blocks/FrameStrip';
import type { LineSeries } from '@/components/blocks/MiniLineChart';
import type { MetricsRow } from '@/components/blocks/MetricsTable';
import { beladyPoints, type Anomaly } from '@/core/replace/curve';
import type { ReplCounters, ReplEvent } from '@/core/replace/events';
import { POLICIES, POLICY_NAMES, type Policy } from '@/core/replace/input';
import type { ReplRun } from '@/core/replace/replace';

/** The event on screen at step position `step` (0-based; the end clamps to the last). */
export function eventAt(run: ReplRun, step: number): ReplEvent | undefined {
  if (run.events.length === 0) return undefined;
  return run.events[Math.max(0, Math.min(step, run.events.length - 1))];
}

/** A FrameStrip column for reference `ref` as it stands after `event`. */
function columnFrom(ref: number, event: ReplEvent, fault: boolean): FrameColumn {
  const loaded = event.kind === 'repl.load';
  return {
    ref,
    frames: event.state.frames,
    fault,
    ...(loaded ? { loaded: event.frame! } : {}),
    ...(loaded && event.evicted !== undefined ? { evicted: event.evicted } : {}),
    ...(event.state.useBits ? { useBits: event.state.useBits } : {}),
    ...(event.state.hand !== undefined ? { hand: event.state.hand } : {}),
  };
}

/** Each reference's last event, and whether it faulted. */
function lastEvents(run: ReplRun): { event: ReplEvent; fault: boolean }[] {
  const out: { event: ReplEvent; fault: boolean }[] = [];
  for (const event of run.events) {
    const i = event.state.index;
    const fault = event.kind !== 'repl.hit';
    out[i] = { event, fault: (out[i]?.fault ?? false) || fault };
  }
  return out;
}

/** Every reference's column after the reference is fully served. */
export function finalColumns(run: ReplRun, refString: readonly number[]): FrameColumn[] {
  return lastEvents(run).map(({ event, fault }, i) =>
    columnFrom(refString[i]!, event, fault),
  );
}

/**
 * The columns with the current reference shown as it stands at `event`: mid-fault the
 * frames are still the old ones, and the "in" mark appears at the load.
 */
export function columnsAt(
  run: ReplRun,
  refString: readonly number[],
  event: ReplEvent | undefined,
): FrameColumn[] {
  const columns = finalColumns(run, refString);
  if (!event) return columns;
  const i = event.state.index;
  columns[i] = columnFrom(refString[i]!, event, event.kind !== 'repl.hit');
  return columns;
}

/** Hits over references, as `54.5%`; `—` before the first reference. */
export function hitRate(hits: number, references: number): string {
  if (references === 0) return '—';
  return `${Math.round((hits / references) * 1000) / 10}%`;
}

const EMPTY: ReplCounters = { hits: 0, faults: 0, cold: 0 };

/** The counters after `event`. */
export function countersAt(event: ReplEvent | undefined): ReplCounters {
  if (!event) return EMPTY;
  const { hits, faults, cold } = event.state;
  return { hits, faults, cold };
}

/** References finished at `event`: the current one counts once it has hit or loaded. */
export function referencesDone(event: ReplEvent | undefined): number {
  if (!event) return 0;
  const finished = event.kind === 'repl.hit' || event.kind === 'repl.load';
  return event.state.index + (finished ? 1 : 0);
}

/** One line per policy for the faults-vs-frames chart. */
export function curveSeries(curves: Record<Policy, number[]>): LineSeries[] {
  return POLICIES.map((policy) => ({
    id: policy,
    label: POLICY_NAMES[policy],
    values: curves[policy],
  }));
}

/** Every anomaly on every curve, as `{ policy, ...point }`. */
export function anomaliesOf(
  curves: Record<Policy, number[]>,
): (Anomaly & { policy: Policy })[] {
  return POLICIES.flatMap((policy) =>
    beladyPoints(curves[policy]).map((point) => ({ policy, ...point })),
  );
}

/** The metrics table: one column per policy, over the whole string. */
export function metricsRows(
  totals: Record<Policy, ReplCounters>,
  references: number,
): MetricsRow[] {
  const values = (pick: (c: ReplCounters) => number) =>
    POLICIES.map((policy) => pick(totals[policy]));
  return [
    {
      id: 'faults',
      label: 'Page faults',
      values: values((c) => c.faults),
      better: 'lower',
    },
    { id: 'cold', label: 'Cold (compulsory) faults', values: values((c) => c.cold) },
    {
      id: 'capacity',
      label: 'Capacity faults',
      values: values((c) => c.faults - c.cold),
      better: 'lower',
    },
    { id: 'hits', label: 'Hits', values: values((c) => c.hits), better: 'higher' },
    {
      id: 'hitRate',
      label: 'Hit rate (%)',
      values: values((c) =>
        references === 0 ? 0 : Math.round((c.hits / references) * 1000) / 10,
      ),
      better: 'higher',
    },
  ];
}

const KIND_NAMES: Record<ReplEvent['kind'], string> = {
  'repl.hit': 'hit',
  'repl.fault': 'page fault',
  'repl.scan': 'clock sweep',
  'repl.victim': 'choose a victim',
  'repl.evict': 'evict',
  'repl.load': 'load',
};

/** The inspector heading for an event. */
export function stepHeading(
  event: ReplEvent | undefined,
  refString: readonly number[],
): string {
  if (!event) return 'This step';
  const i = event.state.index;
  return `Reference ${i + 1} of ${refString.length} (page ${refString[i]}): ${KIND_NAMES[event.kind]}`;
}

/* --- U3.4: what the current step adds to the strip, the inspector and the card ----- */

/**
 * The rule that decided this step (G5), for the "Rule used" chip and the highlighted
 * entry in the rules panel. `null` when no convention was involved.
 */
export function ruleIdFor(event: ReplEvent | undefined, policy: Policy): string | null {
  if (!event) return null;
  switch (event.kind) {
    case 'repl.hit':
      return policy === 'opt' ? null : `repl.${policy}`;
    case 'repl.fault':
      return 'repl.miss.kinds';
    case 'repl.scan':
      return 'repl.clock';
    case 'repl.victim':
      return policy === 'opt' ? 'repl.opt' : `repl.${policy}`;
    case 'repl.evict':
      return 'repl.dirty';
    case 'repl.load':
      if (event.evicted === undefined) return 'repl.fill.order';
      return policy === 'clock' || policy === 'lru' ? `repl.${policy}` : null;
  }
}

/**
 * Why the victim was chosen, in the core's own words: the `repl.victim` label reads
 * "Evict 7: loaded first (FIFO)." and this returns "loaded first".
 */
export function victimReason(event: ReplEvent): string {
  const match = /^Evict \d+: (.*?)\.?$/.exec(event.label);
  const reason = match?.[1] ?? event.label;
  return reason.replace(/\s*\((FIFO|LRU|OPT|Clock)\)$/, '');
}

/**
 * The label under each frame on the current step: OPT's look-ahead ("next in 4", R2)
 * and LRU's last use ("used 3 ago"). FIFO and Clock show their state elsewhere.
 */
export function frameNotes(
  event: ReplEvent,
  policy: Policy,
): (string | null)[] | undefined {
  const { state } = event;
  if (policy === 'opt' && state.nextUse) {
    return state.frames.map((page, f) => {
      if (page === null) return null;
      const next = state.nextUse![f];
      return next === null || next === undefined
        ? 'not needed again'
        : `next in ${next - state.index}`;
    });
  }
  if (policy === 'lru' && state.lastUse) {
    return state.frames.map((page, f) => {
      const last = state.lastUse![f];
      if (page === null || last === null || last === undefined) return null;
      const ago = state.index - last;
      return ago === 0 ? 'used now' : `used ${ago} ago`;
    });
  }
  return undefined;
}

/**
 * The strip's columns at `event`, with the current column dressed for the step: the
 * hit frame, the victim and its reason, the page leaving, and the policy's notes.
 */
export function stripColumns(
  run: ReplRun,
  refString: readonly number[],
  event: ReplEvent | undefined,
  policy: Policy,
): FrameColumn[] {
  const columns = columnsAt(run, refString, event);
  if (!event) return columns;
  const i = event.state.index;
  const column: FrameColumn = { ...columns[i]! };
  if (event.kind === 'repl.hit' && event.frame !== undefined)
    column.hitFrame = event.frame;
  if (event.kind === 'repl.victim' && event.frame !== undefined) {
    column.victim = { frame: event.frame, reason: victimReason(event) };
  }
  if (event.kind === 'repl.evict' && event.frame !== undefined) {
    column.leaving = { frame: event.frame, page: event.page };
  }
  const notes = frameNotes(event, policy);
  if (notes) column.notes = notes;
  columns[i] = column;
  return columns;
}

/** The end-of-run sentence: "FIFO with 3 frames: 9 faults (5 cold, 4 capacity) …". */
export function resultSentence(
  policy: Policy,
  frames: number,
  totals: ReplCounters,
  references: number,
): string {
  const { faults, cold, hits } = totals;
  return `${POLICY_NAMES[policy]} with ${frames} ${frames === 1 ? 'frame' : 'frames'}: ${faults} ${faults === 1 ? 'fault' : 'faults'} (${cold} cold, ${faults - cold} capacity) and ${hits} ${hits === 1 ? 'hit' : 'hits'} in ${references} references, a hit rate of ${hitRate(hits, references)}.`;
}

/** What the end-of-run card offers next: a run that contrasts with this one. */
export interface TryNextChoice {
  label: string;
  why: string;
  /** A preset to load, or the same string under another policy. */
  presetId?: string;
  policy?: Policy;
}

export function tryNextFor(
  policy: Policy,
  refString: readonly number[],
  beladyString: readonly number[],
): TryNextChoice {
  const isBelady =
    refString.length === beladyString.length &&
    refString.every((page, i) => page === beladyString[i]);
  if (isBelady && policy === 'fifo') {
    return {
      label: 'Same string, LRU',
      why: 'LRU is a stack algorithm: a frame more can never cost it a fault.',
      presetId: 'belady-lru',
    };
  }
  switch (policy) {
    case 'fifo':
      return {
        label: 'LRU on the same string',
        why: 'FIFO ignores use; LRU keeps what was used recently.',
        policy: 'lru',
      };
    case 'lru':
      return {
        label: 'OPT on the same string',
        why: 'OPT is the yardstick: no policy can fault less.',
        policy: 'opt',
      };
    case 'opt':
      return {
        label: 'Clock on the same string',
        why: 'Clock is what real systems run: LRU’s idea with one bit per frame.',
        policy: 'clock',
      };
    case 'clock':
      return {
        label: 'Belady’s anomaly (FIFO)',
        why: 'A string where one frame more means more faults.',
        presetId: 'belady',
      };
  }
}

/**
 * The Belady callout (R3): shown exactly when the larger memory has faulted more often
 * than the smaller one so far.
 */
export function beladyOvertakes(smallFaults: number, largeFaults: number): boolean {
  return largeFaults > smallFaults;
}
