/**
 * Turning a scheduling run into what the shared blocks draw. Pure functions, no React:
 * the module renders the core's decisions, it never makes its own.
 */

import type { GanttLane, GanttSegment } from '@/components/blocks/GanttChart';
import type { MetricsRow } from '@/components/blocks/MetricsTable';
import type { QueueItem, ReadyQueue } from '@/components/blocks/QueueView';
import type { SchedEvent, SchedSegment, SchedSnapshot } from '@/core/sched/events';
import type { RunMetrics } from '@/core/sched/metrics';
import type { SchedRun } from '@/core/sched/schedule';
import { pidNumber, type Policy, type Workload } from '@/core/sched/workload';

export function toGanttSegments(segments: readonly SchedSegment[]): GanttSegment[] {
  return segments.map((s) => {
    const out: GanttSegment =
      s.pid === 'idle'
        ? { start: s.start, end: s.end, kind: 'idle' }
        : s.pid === 'cs'
          ? { start: s.start, end: s.end, kind: 'cs' }
          : { start: s.start, end: s.end, kind: 'run', pid: pidNumber(s.pid) };
    if (s.level !== undefined) out.lane = s.level;
    return out;
  });
}

/** One Gantt lane per MLFQ queue; no lanes for the other policies. */
export function ganttLanes(policy: Policy): GanttLane[] | undefined {
  if (policy.kind !== 'mlfq') return undefined;
  return policy.levels.map((level, i) => ({
    id: i,
    label: `Q${i} (q = ${level.quantum})`,
  }));
}

/** The final segments of a run. */
export function finalSegments(run: SchedRun): SchedSegment[] {
  return run.events[run.events.length - 1]?.state.segments ?? [];
}

/** Ticks in the run. */
export function runTicks(run: SchedRun): number {
  return Math.round(run.durationMs / 1000);
}

/** Every event at instant `tick`. */
export function eventsAt(run: SchedRun, tick: number): SchedEvent[] {
  return run.events.filter((event) => event.tick === tick);
}

/** The scheduler state at `tick`: after the last event at or before it. */
export function snapshotAt(run: SchedRun, tick: number): SchedSnapshot | undefined {
  let found: SchedEvent | undefined;
  for (const event of run.events) {
    if (event.tick > tick) break;
    found = event;
  }
  return found?.state;
}

const ROUTINE: ReadonlySet<SchedEvent['kind']> = new Set([
  'sched.run',
  'sched.idle',
  'sched.contextSwitch',
]);

/**
 * The event the inspector leads with at a tick: the last decision (dispatch, preempt,
 * finish, ...), or, on a tick with no decision, what the CPU did.
 */
export function primaryEvent(events: readonly SchedEvent[]): SchedEvent | undefined {
  const decisions = events.filter((event) => !ROUTINE.has(event.kind));
  return decisions[decisions.length - 1] ?? events[events.length - 1];
}

export function queueLabel(policy: Policy, level: number): string {
  if (policy.kind !== 'mlfq') return 'Ready queue';
  const quantum = policy.levels[level]?.quantum;
  return `Q${level} (${level === 0 ? 'top, ' : ''}q = ${quantum})`;
}

export interface QueueState {
  running: QueueItem | null;
  queues: ReadyQueue[];
  waiting: QueueItem[] | undefined;
}

export function queueState(
  snapshot: SchedSnapshot | undefined,
  policy: Policy,
  workload: Workload,
): QueueState {
  const hasIo = workload.processes.some((p) => p.bursts.length > 1);
  if (!snapshot) {
    return {
      running: null,
      queues: [{ id: 'q0', label: queueLabel(policy, 0), items: [] }],
      waiting: hasIo ? [] : undefined,
    };
  }
  const item = (pid: string): QueueItem => {
    const detail: string[] = [];
    if (snapshot.priorities) detail.push(`priority ${snapshot.priorities[pid]}`);
    const out: QueueItem = { pid: pidNumber(pid), remaining: snapshot.remaining[pid] };
    if (detail.length > 0) out.detail = detail.join(', ');
    return out;
  };
  let running: QueueItem | null = null;
  if (snapshot.running) running = item(snapshot.running);
  else if (snapshot.cs) {
    running = {
      pid: pidNumber(snapshot.cs.to),
      detail: `switching in: context switch, ${snapshot.cs.left} ${snapshot.cs.left === 1 ? 'tick' : 'ticks'} left`,
    };
  }
  return {
    running,
    queues: snapshot.queues.map((queue, level) => ({
      id: `q${level}`,
      label: queueLabel(policy, level),
      items: queue.map(item),
    })),
    waiting: hasIo
      ? snapshot.io.map((entry) => ({
          pid: pidNumber(entry.pid),
          detail: `ready at t = ${entry.until}`,
        }))
      : undefined,
  };
}

export const PROCESS_COLUMNS = [
  { id: 'arrival', label: 'Arrival' },
  { id: 'cpu', label: 'CPU' },
  { id: 'completion', label: 'Completion' },
  { id: 'turnaround', label: 'Turnaround' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'response', label: 'Response' },
] as const;

/** Rows = processes, columns = `PROCESS_COLUMNS`. Unfinished values are `null`. */
export function processRows(metrics: RunMetrics): MetricsRow[] {
  return metrics.processes.map((p) => ({
    id: p.pid,
    label: p.pid,
    values: [p.arrival, p.cpu, p.completion, p.turnaround, p.waiting, p.response],
  }));
}

/** Percent with up to one decimal. */
export function percent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}
