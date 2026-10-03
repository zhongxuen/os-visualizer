import type { CitationId } from '../../citations/types';
import { comparePid } from '../workload';

/**
 * What a policy decides, and nothing else. The kernel owns time, queues, I/O, context
 * switches and the event log; a policy only answers "who runs next?", "should the
 * running process be preempted?" and "how long may it run?".
 */

/** A process as the kernel tracks it. */
export interface ProcState {
  pid: string;
  arrival: number;
  bursts: readonly number[];
  basePriority: number;
  /** Effective priority: the base, lowered by aging while the process waits. */
  priority: number;
  /** Index into `bursts`: even = CPU, odd = I/O. */
  burst: number;
  /** Ticks left in the current CPU burst. */
  remaining: number;
  /** Ticks waited in a ready queue since the last aging step or since it last ran. */
  waited: number;
  /** MLFQ queue level, 0 = top. */
  level: number;
  /** MLFQ: ticks used at the current level (rule 4 accounting). */
  levelUsed: number;
  /** Ticks run since this dispatch, for the quantum. */
  slice: number;
}

export interface PolicyView {
  /** Ready queues, head first. */
  queues: readonly (readonly string[])[];
  procs: Readonly<Record<string, ProcState>>;
}

export interface Choice {
  pid: string;
  /** The queue it was taken from. */
  queue: number;
  /** "P3 runs: shortest next burst (2)". */
  reason: string;
}

export interface Preemption {
  pid: string;
  /** "P2 preempts P1: 4 ticks left < 7". */
  reason: string;
}

export interface SchedPolicy {
  /** Number of ready queues. */
  levels: number;
  /** Cited by this policy's dispatch and preempt events. */
  citation: CitationId;
  /** Short name used in labels, e.g. "SRTF". */
  name: string;
  /** Queue a process joins when it becomes ready (arrival, I/O done, preemption). */
  queueFor(proc: ProcState): number;
  /** Ticks one dispatch may run before its quantum expires, or `null` for no quantum. */
  quantum(proc: ProcState): number | null;
  /** The next process to run, or `null` if every queue is empty. */
  pick(view: PolicyView): Choice | null;
  /** Whether a ready process should take the CPU from `running`. Equal keys never do. */
  preempt(view: PolicyView, running: ProcState): Preemption | null;
}

/** Every ready process, queue by queue, head first. */
export function readyPids(view: PolicyView): string[] {
  return view.queues.flat();
}

/** The lowest key wins; ties go to the lower PID. */
export function minByKey(
  pids: readonly string[],
  key: (pid: string) => number,
): { pid: string; ties: string[] } | null {
  let best: string | null = null;
  for (const pid of pids) {
    if (
      best === null ||
      key(pid) < key(best) ||
      (key(pid) === key(best) && comparePid(pid, best) < 0)
    ) {
      best = pid;
    }
  }
  if (best === null) return null;
  const winner = best;
  const ties = pids
    .filter((pid) => pid !== winner && key(pid) === key(winner))
    .sort(comparePid);
  return { pid: winner, ties };
}

/** A key-based pick from a single queue with a reason that says why. */
export function pickByKey(
  view: PolicyView,
  key: (proc: ProcState) => number,
  describe: (value: number) => string,
): Choice | null {
  const pids = readyPids(view);
  const result = minByKey(pids, (pid) => key(view.procs[pid]!));
  if (!result) return null;
  const value = key(view.procs[result.pid]!);
  let reason: string;
  if (pids.length === 1) {
    reason = `${result.pid} runs: the only ready process`;
  } else {
    reason = `${result.pid} runs: ${describe(value)}`;
    if (result.ties.length > 0) {
      reason += `; tie with ${result.ties.join(', ')} goes to the lower PID`;
    }
  }
  return { pid: result.pid, queue: 0, reason };
}

/** Head of the single ready queue (FCFS, RR). */
export function pickHead(view: PolicyView, describe: string): Choice | null {
  const queue = view.queues[0] ?? [];
  const pid = queue[0];
  if (pid === undefined) return null;
  return {
    pid,
    queue: 0,
    reason:
      queue.length === 1
        ? `${pid} runs: the only ready process`
        : `${pid} runs: ${describe}`,
  };
}
