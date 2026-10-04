/**
 * Turning a synchronisation run into what the views draw. Pure functions, no React: the
 * module renders the core's decisions, it never makes its own.
 */

import type { SyncEvent, SyncSnapshot } from '@/core/sync/events';
import type { Exploration, OutcomeGroup } from '@/core/sync/explore';
import { effectivePicks, formatValues, type SyncRun } from '@/core/sync/interleave';
import { threadName, type Program } from '@/core/sync/program';

/** Every event at tick `tick`. */
export function eventsAt(run: SyncRun, tick: number): SyncEvent[] {
  return run.events.filter((event) => event.tick === tick);
}

/** The state after `tick` ops: after the last event at or before it. */
export function snapshotAt(run: SyncRun, tick: number): SyncSnapshot | undefined {
  let found: SyncEvent | undefined;
  for (const event of run.events) {
    if (event.tick > tick) break;
    found = event;
  }
  return found?.state;
}

/** The event the inspector leads with: the op, or the run's closing verdict. */
export function primaryEvent(events: readonly SyncEvent[]): SyncEvent | undefined {
  return events[events.length - 1];
}

/** Ticks in the run. */
export function runTicks(run: SyncRun): number {
  return Math.round(run.durationMs / 1000);
}

/** A thread's state in words, so it never rests on greying out alone. */
export function threadStatusText(snapshot: SyncSnapshot, t: number): string {
  const on = snapshot.waitingOn[t];
  switch (snapshot.status[t]) {
    case 'done':
      return 'Finished';
    case 'blocked':
      return `Asleep on ${on}`;
    case 'spinning': {
      const holder = on === null ? null : snapshot.locks[on];
      return holder === null || holder === undefined
        ? `Can’t take ${on}`
        : `Can’t take ${on}: held by ${threadName(holder)}`;
    }
    default:
      return 'Ready';
  }
}

/** The effective picks of the first `tick` ticks of a run, spins left out. */
export function picksUpTo(run: SyncRun, tick: number): number[] {
  return effectivePicks({ ...run, events: run.events.filter((e) => e.tick <= tick) });
}

/** One sentence for where the run stands at the end. */
export function runVerdict(program: Program, run: SyncRun): string {
  const last = run.events[run.events.length - 1];
  const state = last?.state;
  if (!state) return '';
  if (!state.result) {
    return state.next.length > 0
      ? `Waiting for the next pick: ${state.next.map(threadName).join(' or ')} can run.`
      : 'No thread can run.';
  }
  return last.label;
}

export interface HistogramRow {
  key: string;
  label: string;
  /** "correct", "wrong", "stuck" or "error", as text, never colour alone. */
  verdict: string;
  count: number;
  share: number;
  example: number[];
}

export function histogramRows(exploration: Exploration): HistogramRow[] {
  if (exploration.tooLarge) return [];
  return exploration.groups.map((group: OutcomeGroup) => ({
    key: group.key,
    label: group.label,
    verdict:
      group.kind === 'stuck'
        ? 'stuck'
        : group.kind === 'error'
          ? 'error'
          : group.correct === false
            ? 'wrong'
            : group.correct
              ? 'correct'
              : 'finished',
    count: group.count,
    share: exploration.total === 0 ? 0 : group.count / exploration.total,
    example: group.example,
  }));
}

/** "20 interleavings: 2 give counter = 2, 18 give counter = 1." */
export function explorationSummary(exploration: Exploration): string {
  if (exploration.tooLarge) {
    return `Too many states to explore (more than ${exploration.states}).`;
  }
  const { total, groups } = exploration;
  const parts = groups.map((g) =>
    g.kind === 'done'
      ? `${g.count} give ${formatValues(g.values)}`
      : `${g.count} end ${g.label.charAt(0).toLowerCase()}${g.label.slice(1)}`,
  );
  return `${total} ${total === 1 ? 'interleaving' : 'interleavings'}: ${parts.join('; ')}.`;
}
