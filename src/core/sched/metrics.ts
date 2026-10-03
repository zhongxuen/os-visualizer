/**
 * Scheduling metrics, with the textbook definitions (OSC10 §5.2, OSTEP §7.2 and §7.6).
 *
 * Computed from the run's final snapshot (its Gantt segments and finished list) and the
 * workload, never from the kernel's internals, so the numbers shown are the numbers the
 * chart draws.
 */

import type { SimResult } from '../sim/result';
import type { SchedEvent, SchedSegment } from './events';
import { comparePid, totalCpu, totalIo, type Workload } from './workload';

export interface ProcessMetrics {
  pid: string;
  arrival: number;
  cpu: number;
  io: number;
  /** `null` if the process did not finish within the tick limit. */
  completion: number | null;
  /** completion − arrival. */
  turnaround: number | null;
  /** turnaround − total CPU − total I/O: time spent ready but not running. */
  waiting: number | null;
  /** first run − arrival. `null` if it never ran. */
  response: number | null;
}

export interface RunMetrics {
  processes: ProcessMetrics[];
  /** Averages over the processes that finished. */
  avgTurnaround: number;
  avgWaiting: number;
  avgResponse: number;
  totalTicks: number;
  busyTicks: number;
  idleTicks: number;
  csTicks: number;
  /** busy ticks / total ticks. */
  utilisation: number;
  /** finished processes / total ticks. */
  throughput: number;
  contextSwitches: number;
  /** False if the run stopped at the tick limit. */
  complete: boolean;
}

/** The metric definitions shown next to the table. */
export const METRIC_DEFINITIONS: readonly { id: string; term: string; text: string }[] = [
  { id: 'turnaround', term: 'Turnaround', text: 'completion − arrival' },
  {
    id: 'waiting',
    term: 'Waiting',
    text: 'turnaround − total CPU − total I/O: time spent in a ready queue, including time lost to context switches',
  },
  { id: 'response', term: 'Response', text: 'first run − arrival' },
  { id: 'utilisation', term: 'CPU utilisation', text: 'busy ticks / total ticks' },
  { id: 'throughput', term: 'Throughput', text: 'finished processes / total ticks' },
  {
    id: 'cs',
    term: 'Context switches',
    text: 'how many times the CPU switched to a different process (the first dispatch is free)',
  },
];

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

export function metricsFrom(
  workload: Workload,
  segments: readonly SchedSegment[],
  done: readonly string[],
  totalTicks: number,
): RunMetrics {
  const processes = [...workload.processes]
    .sort((a, b) => comparePid(a.pid, b.pid))
    .map((p): ProcessMetrics => {
      const runs = segments.filter((s) => s.pid === p.pid);
      const finished = done.includes(p.pid);
      const completion = finished ? runs[runs.length - 1]!.end : null;
      const cpu = totalCpu(p);
      const io = totalIo(p);
      const turnaround = completion === null ? null : completion - p.arrival;
      return {
        pid: p.pid,
        arrival: p.arrival,
        cpu,
        io,
        completion,
        turnaround,
        waiting: turnaround === null ? null : turnaround - cpu - io,
        response: runs.length > 0 ? runs[0]!.start - p.arrival : null,
      };
    });

  const sum = (kind: (s: SchedSegment) => boolean) =>
    segments.filter(kind).reduce((n, s) => n + s.end - s.start, 0);
  const idleTicks = sum((s) => s.pid === 'idle');
  const csTicks = sum((s) => s.pid === 'cs');
  const busyTicks = sum((s) => s.pid !== 'idle' && s.pid !== 'cs');
  const finished = processes.filter((p) => p.completion !== null);

  return {
    processes,
    avgTurnaround: mean(finished.map((p) => p.turnaround!)),
    avgWaiting: mean(finished.map((p) => p.waiting!)),
    avgResponse: mean(
      processes.filter((p) => p.response !== null).map((p) => p.response!),
    ),
    totalTicks,
    busyTicks,
    idleTicks,
    csTicks,
    utilisation: totalTicks === 0 ? 0 : busyTicks / totalTicks,
    throughput: totalTicks === 0 ? 0 : finished.length / totalTicks,
    contextSwitches: segments.filter((s) => s.pid === 'cs').length,
    complete: finished.length === processes.length,
  };
}

/** Metrics for a finished run. */
export function runMetrics(workload: Workload, run: SimResult<SchedEvent>): RunMetrics {
  const last = run.events[run.events.length - 1];
  const segments = last?.state.segments ?? [];
  const done = last?.state.done ?? [];
  return metricsFrom(workload, segments, done, run.durationMs / 1000);
}
