import { runMetrics, schedule, type Policy, type Workload } from '@/core/sched';
import type { SchedEvent, SchedSegment } from '@/core/sched/events';

export function proc(
  pid: string,
  arrival: number,
  bursts: number[],
  priority = 0,
): Workload['processes'][number] {
  return { pid, arrival, bursts, priority };
}

export function workload(processes: Workload['processes'], contextSwitch = 0): Workload {
  return { processes, contextSwitch };
}

/** All at t = 0, P1.., one CPU burst each. */
export function burstsAtZero(...lengths: number[]): Workload {
  return workload(lengths.map((b, i) => proc(`P${i + 1}`, 0, [b])));
}

export function run(w: Workload, policy: Policy) {
  const result = schedule(w, policy);
  const last = result.events[result.events.length - 1]!;
  return {
    result,
    events: result.events,
    segments: last.state.segments,
    metrics: runMetrics(w, result),
    kinds: (kind: SchedEvent['kind']) => result.events.filter((e) => e.kind === kind),
  };
}

/** `'P1[0-3) cs[3-4) P2@1[4-6)'`: a segment layout, easy to compare with a figure. */
export function layout(segments: readonly SchedSegment[]): string {
  return segments
    .map(
      (s) => `${s.pid}${s.level === undefined ? '' : `@${s.level}`}[${s.start}-${s.end})`,
    )
    .join(' ');
}
