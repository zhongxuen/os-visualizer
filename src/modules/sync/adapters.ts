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

/** A store that overwrote another thread's update, as MemoryView strikes it through. */
export interface LostUpdate {
  var: string;
  /** The value that was overwritten: the other thread's update. */
  lost: number;
  /** The value written over it. */
  value: number;
  /** The thread whose stale store wiped the update out. */
  by: number;
  /** The thread whose update was lost, when a store by it is on record. */
  victim: number | null;
  /** The tick of the overwriting store. */
  tick: number;
}

/**
 * For each shared variable whose latest store, up to `tick`, lost an update (the core
 * marks it `lost`, rule `sync.lost`): the value it overwrote and who did it. The mark
 * stays until the next store to that variable, so a paused frame and the end of the run
 * still show it (§6.1 rule 4).
 */
export function lostUpdatesAt(
  program: Program,
  run: SyncRun,
  tick: number,
): Record<string, LostUpdate> {
  const found: Record<string, LostUpdate> = {};
  const lastWriter: Record<string, number> = {};
  let before: SyncSnapshot | undefined;
  for (const event of run.events) {
    if (event.tick > tick) break;
    if (
      event.kind === 'sync.store' &&
      event.thread !== undefined &&
      event.op !== undefined
    ) {
      const op = program.threads[event.thread]?.ops[event.op];
      if (op && op.op === 'store') {
        if (event.lost) {
          found[op.var] = {
            var: op.var,
            lost: before?.vars[op.var] ?? 0,
            value: event.state.vars[op.var] ?? 0,
            by: event.thread,
            victim: lastWriter[op.var] ?? null,
            tick: event.tick,
          };
        } else {
          delete found[op.var];
        }
        lastWriter[op.var] = event.thread;
      }
    }
    before = event.state;
  }
  return found;
}

/**
 * The rule that decided a step, for the inspector's "Rule used" chip (G5), or `null` for
 * an op that follows from the program alone.
 */
export function ruleForEvent(event: SyncEvent | undefined): string | null {
  if (!event) return null;
  switch (event.kind) {
    case 'sync.store':
      return event.lost ? 'sync.lost' : null;
    case 'sync.lock':
    case 'sync.spin':
      return 'sync.tas';
    case 'sync.block':
      return 'sync.sem.value';
    case 'sync.signal':
      return 'sync.sem.signal';
    case 'sync.stuck':
      return 'sync.stuck';
    case 'sync.invalid':
      return 'sync.manual';
    case 'sync.error':
      return 'sync.unlock.owner';
    case 'sync.limit':
      return 'sync.limit';
    default:
      return null;
  }
}

/**
 * "Try this next" on the end-of-run card (G16): for each preset, the one that contrasts
 * with it, and why.
 */
export const TRY_NEXT: Record<string, { preset: string; why: string }> = {
  'counter-race': {
    preset: 'counter-mutex',
    why: 'The same two increments inside a lock: every interleaving now ends at 2.',
  },
  'counter-mutex': {
    preset: 'forgotten-unlock',
    why: 'Leave out one unlock and the second thread can wait forever.',
  },
  'forgotten-unlock': {
    preset: 'lock-order',
    why: 'Two locks taken in opposite orders: a real cycle, a deadlock.',
  },
  'lock-order': {
    preset: 'prodcons-1',
    why: 'Semaphores let threads sleep until there is work, instead of spinning.',
  },
  'prodcons-1': {
    preset: 'prodcons-broken',
    why: 'Take the mutex before waiting, and producer and consumer block each other.',
  },
  'prodcons-2': {
    preset: 'prodcons-broken',
    why: 'Take the mutex before waiting, and producer and consumer block each other.',
  },
  'prodcons-broken': {
    preset: 'counter-race',
    why: 'Back to the start: two threads and one counter, no lock at all.',
  },
};
