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
