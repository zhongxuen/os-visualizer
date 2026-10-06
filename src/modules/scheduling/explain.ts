/**
 * What the scheduling view says *about* a run: which rule decided a tick (G5, S2, S7), who
 * waited and why (S8), one process's brackets (S3), how much of the quantum is used,
 * where the preemptions are, and what to try next (G16).
 *
 * Pure functions over the core's run and snapshots. Nothing here decides anything the
 * core has not already decided; it only reads the events back.
 */

import type { GanttBrackets, GanttMark } from '@/components/blocks/GanttChart';
import type { SchedEvent, SchedSegment, SchedSnapshot } from '@/core/sched/events';
import type { RunMetrics } from '@/core/sched/metrics';
import { rulesFor } from '@/core/sched/rules';
import type { SchedRun } from '@/core/sched/schedule';
import {
  comparePid,
  pidNumber,
  policyName,
  type Policy,
  type Workload,
} from '@/core/sched/workload';

import { eventsAt } from './adapters';

/* --- Rule used (G5) -------------------------------------------------------- */

/** The state just before `event`, or `undefined` for the first event. */
function stateBefore(run: SchedRun, event: SchedEvent): SchedSnapshot | undefined {
  const index = run.events.indexOf(event);
  return index > 0 ? run.events[index - 1]!.state : undefined;
}

/** The policy's sort key for `pid`, for the policies that have one. */
function keyOf(policy: Policy, state: SchedSnapshot, pid: string): number | null {
  if (policy.kind === 'sjf' || policy.kind === 'srtf')
    return state.remaining[pid] ?? null;
  if (policy.kind === 'priority') return state.priorities?.[pid] ?? null;
  return null;
}

/** Did the dispatch at `event` pick between processes whose keys tie? */
export function dispatchTied(run: SchedRun, event: SchedEvent, policy: Policy): boolean {
  if (event.kind !== 'sched.dispatch' || !event.pid) return false;
  const before = stateBefore(run, event);
  if (!before) return false;
  const mine = keyOf(policy, before, event.pid);
  if (mine === null) return false;
  return before.queues
    .flat()
    .some((pid) => pid !== event.pid && keyOf(policy, before, pid) === mine);
}

/**
 * The id of the rule that decided what happens at `tick`, or `null` when the step is
 * routine. Only rules that apply to the policy are returned.
 */
export function ruleAt(run: SchedRun, tick: number, policy: Policy): string | null {
  const events = eventsAt(run, tick);
  const has = (kind: SchedEvent['kind']) => events.some((e) => e.kind === kind);
  const first = (kind: SchedEvent['kind']) => events.find((e) => e.kind === kind);
  const dispatch = first('sched.dispatch');
  const arrivals = events.filter((e) => e.kind === 'sched.arrive').length;

  const candidates: (string | null)[] = [
    has('sched.limit') ? 'sched.limit' : null,
    has('sched.boost') ? 'sched.mlfq.boost' : null,
    has('sched.demote')
      ? policy.kind === 'mlfq' && policy.rule4 === 'original'
        ? 'sched.mlfq.original'
        : 'sched.mlfq.allotment'
      : null,
    has('sched.quantumExpired') && (arrivals > 0 || has('sched.ioDone'))
      ? 'sched.order.quantum'
      : null,
    dispatch && dispatchTied(run, dispatch, policy) ? 'sched.tie.pid' : null,
    has('sched.preempt') ? 'sched.preempt.tail' : null,
    equalKeyHeld(run, tick, policy) ? 'sched.preempt.equal' : null,
    has('sched.age') ? 'sched.priority.aging' : null,
    dispatch?.other ? 'sched.cs.cost' : null,
    dispatch && policy.kind === 'priority' ? 'sched.priority.lower' : null,
    dispatch && (policy.kind === 'sjf' || policy.kind === 'srtf')
      ? 'sched.sjf.next'
      : null,
    arrivals > 1 ? 'sched.order.arrivals' : null,
    arrivals > 0 && has('sched.ioDone') ? 'sched.order.io' : null,
    has('sched.contextSwitch') ? 'sched.cs.cost' : null,
    policy.kind === 'mlfq' && (arrivals > 0 || dispatch) ? 'sched.mlfq.enter' : null,
    has('sched.ioStart') || has('sched.ioDone') ? 'sched.io.fixed' : null,
  ];
  const allowed = new Set(rulesFor(policy.kind).map((r) => r.id));
  return candidates.find((id): id is string => id !== null && allowed.has(id)) ?? null;
}

/**
 * SRTF or preemptive priority, at a tick where a process arrived (or came back) with
 * exactly the running process's key and did not take the CPU: "equal keys never
 * preempt".
 */
function equalKeyHeld(run: SchedRun, tick: number, policy: Policy): boolean {
  const preemptive =
    policy.kind === 'srtf' || (policy.kind === 'priority' && policy.preemptive);
  if (!preemptive) return false;
  const events = eventsAt(run, tick);
  if (events.some((e) => e.kind === 'sched.preempt' || e.kind === 'sched.dispatch')) {
    return false;
  }
  const last = events[events.length - 1]?.state;
  const running = last?.running;
  if (!last || !running) return false;
  const mine = keyOf(policy, last, running);
  return events
    .filter((e) => (e.kind === 'sched.arrive' || e.kind === 'sched.ioDone') && e.pid)
    .some((e) => keyOf(policy, last, e.pid!) === mine);
}

/* --- Who waited, and why (S8) --------------------------------------------- */

export interface WaitingReason {
  pid: string;
  text: string;
}

/**
 * On a dispatch step: the next two processes the policy passed over, each with why,
 * read off the snapshot ("P2 (arrived t = 1): longer burst, 8 vs 3"). Empty on any
 * other step.
 */
export function waitingReasons(
  run: SchedRun,
  tick: number,
  policy: Policy,
  workload: Workload,
): WaitingReason[] {
  const dispatch = eventsAt(run, tick).find((e) => e.kind === 'sched.dispatch');
  if (!dispatch?.pid) return [];
  const picked = dispatch.pid;
  const state = stateBefore(run, dispatch) ?? dispatch.state;
  const after = dispatch.state;
  const arrival = (pid: string) =>
    workload.processes.find((p) => p.pid === pid)?.arrival ?? 0;
  const levelOf = (pid: string) => after.queues.findIndex((q) => q.includes(pid));

  let order: string[];
  if (policy.kind === 'mlfq') order = after.queues.flat();
  else if (policy.kind === 'fcfs' || policy.kind === 'rr') order = [...after.queues[0]!];
  else {
    order = [...after.queues.flat()].sort(
      (a, b) =>
        (keyOf(policy, state, a) ?? 0) - (keyOf(policy, state, b) ?? 0) ||
        comparePid(a, b),
    );
  }

  const mine = keyOf(policy, state, picked);
  return order.slice(0, 2).map((pid) => {
    const key = keyOf(policy, state, pid);
    let why: string;
    switch (policy.kind) {
      case 'sjf':
      case 'srtf': {
        const what = policy.kind === 'sjf' ? 'next burst' : 'time left';
        why =
          key === mine
            ? `same ${what} (${key}); the lower PID goes first`
            : `longer ${what}, ${key} vs ${mine}`;
        break;
      }
      case 'priority':
        why =
          key === mine
            ? `same priority (${key}); the lower PID goes first`
            : `priority ${key} vs ${mine} (0 is the highest)`;
        break;
      case 'mlfq': {
        const level = levelOf(pid);
        const pickedLevel = dispatch.level ?? 0;
        why =
          level > pickedLevel
            ? `in Q${level}, below Q${pickedLevel}; a higher queue runs first`
            : `behind ${picked} in Q${level}`;
        break;
      }
      default:
        why = `behind ${picked} in the queue`;
    }
    return { pid, text: `${pid} (arrived t = ${arrival(pid)}): ${why}` };
  });
}

/* --- Brackets (S3) --------------------------------------------------------- */

/**
 * One process's response, turnaround and waiting on the final schedule. Waiting is
 * every tick between arrival and completion that the process neither ran nor spent in
 * I/O, so the shaded ticks add up to the waiting time in the metrics table (context
 * switches into it count as waiting, as the table's definition says).
 */
export function bracketsFor(
  workload: Workload,
  segments: readonly SchedSegment[],
  pid: string,
): GanttBrackets | null {
  const process = workload.processes.find((p) => p.pid === pid);
  if (!process) return null;
  const runs = segments.filter((s) => s.pid === pid);
  const cpuBursts = process.bursts.filter((_, i) => i % 2 === 0);
  const end = segments.reduce((max, s) => Math.max(max, s.end), process.arrival);

  // I/O follows each CPU burst but the last.
  const busy = new Set<number>();
  let used = 0;
  let burst = 0;
  let target = cpuBursts[0] ?? 0;
  let finishedAt: number | null = null;
  for (const segment of runs) {
    for (let t = segment.start; t < segment.end; t += 1) {
      busy.add(t);
      used += 1;
      if (used === target) {
        if (burst === cpuBursts.length - 1) {
          finishedAt = t + 1;
        } else {
          const io = process.bursts[burst * 2 + 1]!;
          for (let k = t + 1; k < t + 1 + io; k += 1) busy.add(k);
          burst += 1;
          target += cpuBursts[burst]!;
        }
      }
    }
  }

  const waiting: { start: number; end: number }[] = [];
  const stop = finishedAt ?? end;
  for (let t = process.arrival; t < stop; t += 1) {
    if (busy.has(t)) continue;
    const last = waiting[waiting.length - 1];
    if (last && last.end === t) last.end = t + 1;
    else waiting.push({ start: t, end: t + 1 });
  }

  return {
    pid: pidNumber(pid),
    arrival: process.arrival,
    firstRun: runs[0]?.start ?? null,
    completion: finishedAt,
    waiting,
  };
}

/* --- Quantum ring ---------------------------------------------------------- */

export interface QuantumUse {
  pid: string;
  used: number;
  quantum: number;
}

/**
 * How much of its quantum the running process has used at `tick` (RR and MLFQ): the
 * ticks it has run since its last dispatch.
 */
export function quantumUse(
  run: SchedRun,
  tick: number,
  policy: Policy,
  snapshot: SchedSnapshot | undefined,
): QuantumUse | null {
  if (policy.kind !== 'rr' && policy.kind !== 'mlfq') return null;
  const pid = snapshot?.running;
  if (!snapshot || !pid) return null;
  let since = 0;
  for (const event of run.events) {
    if (event.tick > tick) break;
    if (event.kind === 'sched.dispatch' && event.pid === pid) since = event.tick;
  }
  const used = snapshot.segments
    .filter((s) => s.pid === pid && s.end > since && s.start < tick)
    .reduce((n, s) => n + Math.min(s.end, tick) - Math.max(s.start, since), 0);
  const quantum =
    policy.kind === 'rr'
      ? policy.quantum
      : (policy.levels[snapshot.levels?.[pid] ?? 0]?.quantum ?? 1);
  return { pid, used: Math.min(used, quantum), quantum };
}

/* --- Notches --------------------------------------------------------------- */

/** A notch where a process lost the CPU: a preemption or a quantum expiry. */
export function preemptionMarks(run: SchedRun, mlfq: boolean): GanttMark[] {
  const final = run.events[run.events.length - 1]?.state.segments ?? [];
  const marks: GanttMark[] = [];
  for (const event of run.events) {
    const lost =
      event.kind === 'sched.preempt'
        ? event.other
        : event.kind === 'sched.quantumExpired'
          ? event.pid
          : undefined;
    if (!lost) continue;
    const segment = final.find((s) => s.pid === lost && s.end === event.tick);
    const mark: GanttMark = {
      tick: event.tick,
      label:
        event.kind === 'sched.preempt'
          ? `${lost} preempted at t = ${event.tick}`
          : `${lost}’s quantum expired at t = ${event.tick}`,
    };
    if (mlfq && segment?.level !== undefined) mark.lane = segment.level;
    marks.push(mark);
  }
  return marks;
}

/* --- End of run (G16) ------------------------------------------------------ */

export interface TryNextInput {
  label: string;
  why: string;
  policy: Policy;
}

/** A policy that contrasts with this one, on the same workload. */
export function tryNextFor(policy: Policy): TryNextInput {
  switch (policy.kind) {
    case 'fcfs':
      return {
        label: 'SJF on the same workload',
        why: 'Shortest job first: watch the average waiting time drop.',
        policy: { kind: 'sjf' },
      };
    case 'sjf':
      return {
        label: 'SRTF on the same workload',
        why: 'The same idea, but a newly arrived short job can take the CPU.',
        policy: { kind: 'srtf' },
      };
    case 'srtf':
      return {
        label: 'Round robin (q = 2) on the same workload',
        why: 'Fairer response times, at the cost of turnaround.',
        policy: { kind: 'rr', quantum: 2 },
      };
    case 'rr':
      return policy.quantum <= 2
        ? {
            label: 'Round robin with q = 8',
            why: 'A bigger quantum: fewer switches, slower response. It drifts towards FCFS.',
            policy: { kind: 'rr', quantum: 8 },
          }
        : {
            label: 'Round robin with q = 1',
            why: 'A smaller quantum: quicker response, many more context switches.',
            policy: { kind: 'rr', quantum: 1 },
          };
    case 'priority':
      return policy.aging
        ? {
            label: 'Round robin (q = 2) on the same workload',
            why: 'No priorities at all: everyone takes turns.',
            policy: { kind: 'rr', quantum: 2 },
          }
        : {
            label: 'The same, with aging',
            why: 'Waiting raises a process’s priority, so nothing starves.',
            policy: { ...policy, aging: { every: 2, by: 1 } },
          };
    case 'mlfq':
      if (policy.rule4 === 'original') {
        return {
          label: 'The same, with the fixed rule 4',
          why: 'Counting time across I/O stops a job from gaming the scheduler.',
          policy: { ...policy, rule4: 'allotment' },
        };
      }
      return policy.boostEvery === undefined
        ? {
            label: 'The same, with a priority boost every 20 ticks',
            why: 'Rule 5 lifts long-running jobs back to the top so they cannot starve.',
            policy: { ...policy, boostEvery: 20 },
          }
        : {
            label: 'FCFS on the same workload',
            why: 'No queues and no quanta: see what MLFQ was protecting against.',
            policy: { kind: 'fcfs' },
          };
  }
}

/** The run's result in one sentence. */
export function resultSentence(
  policy: Policy,
  metrics: RunMetrics,
  segments: readonly SchedSegment[],
): string {
  const first = segments.find((s) => s.pid !== 'idle' && s.pid !== 'cs')?.pid;
  const round = (n: number) => Math.round(n * 100) / 100;
  const parts = [
    `${policyName(policy)}: average waiting ${round(metrics.avgWaiting)} ticks`,
    `average turnaround ${round(metrics.avgTurnaround)} ticks`,
  ];
  const tail = first ? `; ${first} ran first.` : '.';
  return `${parts.join(', ')}${tail}`;
}
