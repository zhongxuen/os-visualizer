/**
 * The tick loop every scheduling policy shares.
 *
 * Policies only decide *who is picked* and *whether the running process is preempted*
 * (`./policies`). Everything else happens here, at each instant `t`, in this order
 * (04-module-1-cpu-scheduling.md step 2; each rule is in `rules.ts` and has a test):
 *
 * 1. Processes arriving at `t` join their ready queue, lowest PID first.
 * 2. Processes whose I/O completes at `t` join, lowest PID first.
 * 3. The running process, if its CPU burst is done, leaves (to I/O or done). If its
 *    quantum expired, it goes to the tail of its queue, after steps 1-2. MLFQ demotion
 *    (rule 4) happens here; then a finished context switch hands over the CPU, the MLFQ
 *    boost (rule 5) and aging are applied.
 * 4. A preemptive policy checks whether a ready process should take the CPU. Equal keys
 *    never preempt.
 * 5. If the CPU is free, the policy picks. Ties go to the lower PID.
 * 6. Starting a process other than the one that ran last costs `contextSwitch` ticks;
 *    the very first dispatch is free.
 * 7. The tick `[t, t + 1)` runs: the running process, a context-switch tick, or idle.
 *
 * Decisions happen *at* the instant `t`, before tick `t` runs, so a process that
 * finishes its burst during tick 6 finishes "at t = 7". The run stops at the instant
 * every process is done, or with a `sched.limit` event at `LIMITS.maxTicks`.
 */

import type { CitationId } from '../citations/types';
import { createRun } from '../events/builder';
import type { SimResult } from '../sim/result';
import type { SchedEvent, SchedEventKind, SchedSegment, SchedSnapshot } from './events';
import { policyImpl } from './policies';
import type { PolicyView, ProcState } from './policies/types';
import { comparePid, LIMITS, type Policy, type Workload } from './workload';

interface Pending {
  kind: SchedEventKind;
  label: string;
  detail?: string;
  citation: CitationId;
  pid?: string;
  other?: string;
  level?: number;
  state: SchedSnapshot;
}

interface PhaseMark {
  tick: number;
  kind: 'dispatch' | 'idle';
  pid?: string;
  reason?: string;
  csTicks?: number;
}

export interface KernelOptions {
  /** Override the tick limit (tests only). */
  maxTicks?: number;
}

export function runKernel(
  workload: Workload,
  policy: Policy,
  { maxTicks = LIMITS.maxTicks }: KernelOptions = {},
): SimResult<SchedEvent> {
  const impl = policyImpl(policy);
  const mlfq = policy.kind === 'mlfq' ? policy : null;
  const aging = policy.kind === 'priority' ? policy.aging : undefined;
  const usesPriority = policy.kind === 'priority';
  const lastLevel = impl.levels - 1;

  const pids = workload.processes.map((p) => p.pid).sort(comparePid);
  const procs: Record<string, ProcState> = {};
  for (const p of workload.processes) {
    procs[p.pid] = {
      pid: p.pid,
      arrival: p.arrival,
      bursts: p.bursts,
      basePriority: p.priority,
      priority: p.priority,
      burst: 0,
      remaining: p.bursts[0]!,
      waited: 0,
      level: 0,
      levelUsed: 0,
      slice: 0,
    };
  }

  const queues: string[][] = Array.from({ length: impl.levels }, () => []);
  const io: { pid: string; until: number }[] = [];
  const done: string[] = [];
  const segments: SchedSegment[] = [];
  let running: string | null = null;
  let cs: { to: string; left: number } | null = null;
  let lastRan: string | null = null;

  const instants: Pending[][] = [];
  const phases: PhaseMark[] = [];
  let t = 0;

  const view = (): PolicyView => ({ queues, procs });

  const snapshot = (): SchedSnapshot => {
    const state: SchedSnapshot = {
      tick: t,
      running,
      cs: cs ? { ...cs } : null,
      queues: queues.map((q) => [...q]),
      io: io.map((entry) => ({ ...entry })),
      remaining: Object.fromEntries(pids.map((pid) => [pid, procs[pid]!.remaining])),
      done: [...done],
      segments: segments.map((s) => ({ ...s })),
    };
    if (mlfq) {
      state.levels = Object.fromEntries(pids.map((pid) => [pid, procs[pid]!.level]));
    }
    if (usesPriority) {
      state.priorities = Object.fromEntries(
        pids.map((pid) => [pid, procs[pid]!.priority]),
      );
    }
    return state;
  };

  const emit = (event: Omit<Pending, 'state'>) => {
    (instants[t] ??= []).push({ ...event, state: snapshot() });
  };

  const queueName = (level: number) =>
    impl.levels === 1 ? 'the ready queue' : `Q${level}`;

  const enqueue = (proc: ProcState) => {
    queues[impl.queueFor(proc)]!.push(proc.pid);
  };

  const removeFromQueues = (pid: string) => {
    for (const q of queues) {
      const i = q.indexOf(pid);
      if (i >= 0) q.splice(i, 1);
    }
  };

  /** Move `proc` down a level; returns the event to emit once the queues are updated. */
  const demote = (proc: ProcState, why: string): Omit<Pending, 'state'> => {
    proc.level += 1;
    proc.levelUsed = 0;
    return {
      kind: 'sched.demote',
      pid: proc.pid,
      level: proc.level,
      label: `${proc.pid} moves down to Q${proc.level}: ${why}`,
      citation: mlfq?.rule4 === 'original' ? 'ostep.8.2' : 'ostep.8.4',
    };
  };

  const extend = (pid: string, level: number | undefined) => {
    const last = segments[segments.length - 1];
    // A context switch is one segment even if a boost changes its level part-way.
    const same =
      last &&
      last.pid === pid &&
      last.end === t &&
      (pid === 'cs' || last.level === level);
    if (last && same) {
      last.end = t + 1;
      return;
    }
    const segment: SchedSegment = { pid, start: t, end: t + 1 };
    if (level !== undefined) segment.level = level;
    segments.push(segment);
  };

  for (;;) {
    // 1. Arrivals, lowest PID first.
    for (const pid of pids) {
      const proc = procs[pid]!;
      if (proc.arrival !== t) continue;
      enqueue(proc);
      emit({
        kind: 'sched.arrive',
        pid,
        label: mlfq
          ? `${pid} arrives and enters the top queue, Q0 (rule 3)`
          : `${pid} arrives and joins the tail of the ready queue`,
        citation: mlfq ? 'ostep.8.2' : 'osc10.5.3.1',
      });
    }

    // 2. I/O completions, lowest PID first.
    const returning = io
      .filter((entry) => entry.until === t)
      .sort((a, b) => comparePid(a.pid, b.pid));
    for (const entry of returning) {
      io.splice(io.indexOf(entry), 1);
      const proc = procs[entry.pid]!;
      proc.burst += 1;
      proc.remaining = proc.bursts[proc.burst]!;
      enqueue(proc);
      emit({
        kind: 'sched.ioDone',
        pid: proc.pid,
        label: `${proc.pid} finishes I/O and joins ${queueName(impl.queueFor(proc))} (next burst ${proc.remaining})`,
        citation: 'ostep.7.8',
      });
    }

    // 3. The running process: finished, demoted or out of quantum.
    if (running !== null) {
      const proc = procs[running]!;
      const quantum = impl.quantum(proc);
      const sliceUsed = quantum !== null && proc.slice >= quantum;
      const allotment = mlfq ? mlfq.levels[proc.level]!.allotment : 0;
      const allotmentUsed =
        mlfq?.rule4 === 'allotment' &&
        proc.level < lastLevel &&
        proc.levelUsed >= allotment;

      let demotion: Omit<Pending, 'state'> | null = null;
      if (mlfq && proc.level < lastLevel) {
        if (mlfq.rule4 === 'original' && sliceUsed) {
          demotion = demote(proc, `it used its whole quantum (${quantum}) (rule 4a)`);
        } else if (allotmentUsed) {
          demotion = demote(
            proc,
            `it used its allotment of ${allotment} at this level (rule 4)`,
          );
        }
      }

      if (proc.remaining === 0) {
        running = null;
        if (demotion) emit(demotion);
        if (proc.burst === proc.bursts.length - 1) {
          done.push(proc.pid);
          emit({
            kind: 'sched.finish',
            pid: proc.pid,
            label: `${proc.pid} finishes at t = ${t}`,
            citation: 'ostep.7.2',
          });
        } else {
          proc.burst += 1;
          const until = t + proc.bursts[proc.burst]!;
          io.push({ pid: proc.pid, until });
          emit({
            kind: 'sched.ioStart',
            pid: proc.pid,
            label: `${proc.pid} starts I/O for ${proc.bursts[proc.burst]} ticks and is ready again at t = ${until}`,
            citation: 'ostep.7.8',
          });
        }
      } else if (sliceUsed || allotmentUsed) {
        running = null;
        enqueue(proc);
        if (sliceUsed) {
          emit({
            kind: 'sched.quantumExpired',
            pid: proc.pid,
            label: `${proc.pid}'s quantum of ${quantum} expires; it goes to the tail of ${queueName(proc.level)}, behind anything that arrived at t = ${t}`,
            citation: mlfq ? 'ostep.8.1' : 'osc10.5.3.3',
          });
        }
        if (demotion) emit(demotion);
      }
    }

    // A finished context switch hands over the CPU. The process switched to runs at
    // least one tick before it can be preempted.
    let protectedPid: string | null = null;
    if (cs !== null && cs.left === 0) {
      running = cs.to;
      protectedPid = cs.to;
      cs = null;
    }

    // MLFQ rule 5: the boost.
    if (mlfq?.boostEvery && t > 0 && t % mlfq.boostEvery === 0) {
      const merged = queues.flat();
      for (const q of queues) q.length = 0;
      queues[0]!.push(...merged);
      for (const pid of pids) {
        const proc = procs[pid]!;
        proc.level = 0;
        proc.levelUsed = 0;
      }
      emit({
        kind: 'sched.boost',
        label: `Priority boost at t = ${t}: every job moves to Q0 (rule 5)`,
        detail:
          'Ready jobs keep their order, higher queues first. Allotments reset. A running job keeps the CPU and the part of its quantum it has used, so frequent boosts cannot keep it running forever.',
        citation: 'ostep.8.3',
      });
    }

    // Aging: every `every` ticks waited lowers the priority number by `by`, floored at 0.
    if (aging) {
      for (const pid of queues.flat().sort(comparePid)) {
        const proc = procs[pid]!;
        if (proc.waited < aging.every) continue;
        proc.waited = 0;
        if (proc.priority === 0) continue;
        const before = proc.priority;
        proc.priority = Math.max(0, proc.priority - aging.by);
        emit({
          kind: 'sched.age',
          pid,
          label: `${pid} has waited ${aging.every} more ticks: priority ages from ${before} to ${proc.priority}`,
          citation: 'osc10.5.3.4',
        });
      }
    }

    // 4. Preemption.
    if (running !== null && running !== protectedPid) {
      const proc = procs[running]!;
      const preemption = impl.preempt(view(), proc);
      if (preemption) {
        proc.slice = 0;
        running = null;
        enqueue(proc);
        emit({
          kind: 'sched.preempt',
          pid: preemption.pid,
          other: proc.pid,
          label: preemption.reason,
          detail: `${proc.pid} goes to the tail of ${queueName(impl.queueFor(proc))} with ${proc.remaining} ticks left.`,
          citation: impl.citation,
        });
      }
    }

    // 5 and 6. Pick, and charge a context switch if the process changes.
    if (running === null && cs === null) {
      const choice = impl.pick(view());
      if (choice) {
        const proc = procs[choice.pid]!;
        removeFromQueues(proc.pid);
        proc.slice = 0;
        proc.waited = 0;
        proc.priority = proc.basePriority;
        const switching =
          lastRan !== null && lastRan !== proc.pid && workload.contextSwitch > 0;
        const ctx = switching
          ? `; a ${workload.contextSwitch}-tick context switch from ${lastRan} comes first`
          : '';
        const event: Omit<Pending, 'state'> = {
          kind: 'sched.dispatch',
          pid: proc.pid,
          label: `${choice.reason}${ctx}`,
          citation: impl.citation,
        };
        if (mlfq) event.level = proc.level;
        if (switching) {
          event.other = lastRan!;
          cs = { to: proc.pid, left: workload.contextSwitch };
        } else {
          running = proc.pid;
        }
        emit(event);
        phases.push({
          tick: t,
          kind: 'dispatch',
          pid: proc.pid,
          reason: choice.reason,
          csTicks: switching ? workload.contextSwitch : 0,
        });
        // The CPU will run this process next; a later switch is measured from it.
        lastRan = proc.pid;
      }
    }

    if (done.length === pids.length) break;
    if (t >= maxTicks) {
      emit({
        kind: 'sched.limit',
        label: `Stopped at the ${maxTicks}-tick limit with ${pids.length - done.length} process(es) unfinished`,
        citation: 'osc10.5',
      });
      break;
    }

    // 7. Run the tick.
    if (running !== null) {
      const proc = procs[running]!;
      proc.remaining -= 1;
      proc.slice += 1;
      proc.levelUsed += 1;
      extend(proc.pid, mlfq ? proc.level : undefined);
      emit({
        kind: 'sched.run',
        pid: proc.pid,
        label:
          proc.remaining === 0
            ? `${proc.pid} runs its last tick of this burst`
            : `${proc.pid} runs (${proc.remaining} ${proc.remaining === 1 ? 'tick' : 'ticks'} left in this burst)`,
        citation: impl.citation,
      });
    } else if (cs !== null) {
      const step = workload.contextSwitch - cs.left + 1;
      cs.left -= 1;
      extend('cs', mlfq ? procs[cs.to]!.level : undefined);
      emit({
        kind: 'sched.contextSwitch',
        pid: cs.to,
        label: `Context switch to ${cs.to} (tick ${step} of ${workload.contextSwitch}): neither busy nor idle`,
        citation: 'osc10.5.1.4',
      });
    } else {
      const previous = segments[segments.length - 1];
      if (!previous || previous.pid !== 'idle' || previous.end !== t) {
        phases.push({ tick: t, kind: 'idle' });
      }
      extend('idle', undefined);
      emit({
        kind: 'sched.idle',
        label:
          io.length > 0
            ? 'CPU idle: every unfinished process is waiting on I/O or has not arrived'
            : 'CPU idle: no process is ready',
        citation: 'osc10.5.2',
      });
    }

    for (const q of queues) for (const pid of q) procs[pid]!.waited += 1;
    t += 1;
  }

  return buildRun(instants, phases, t, segments);
}

function buildRun(
  instants: Pending[][],
  phases: PhaseMark[],
  total: number,
  segments: SchedSegment[],
): SimResult<SchedEvent> {
  const run = createRun<SchedEvent>({ unit: 'tick' });

  const phaseAt = new Map<number, PhaseMark>();
  for (const mark of phases) phaseAt.set(mark.tick, mark);
  const starts = phases.map((mark) => mark.tick);

  for (let tick = 0; tick <= total; tick += 1) {
    const mark = phaseAt.get(tick);
    if (mark) {
      const next = starts.find((s) => s > tick);
      const end = next ?? lastSegmentEnd(segments, total);
      if (mark.kind === 'idle') {
        run.phase(
          `idle-${tick}`,
          `Idle, t = ${tick}–${end}`,
          'No process is ready, so the CPU idles.',
        );
      } else {
        const cs = mark.csTicks ?? 0;
        run.phase(
          `run-${tick}`,
          `${mark.pid} runs, t = ${tick}–${end}`,
          cs > 0
            ? `${mark.reason}. A ${cs}-tick context switch takes t = ${tick}–${tick + cs}, then ${mark.pid} runs until t = ${end}.`
            : `${mark.reason}. It holds the CPU until t = ${end}.`,
        );
      }
    }
    const events = instants[tick] ?? [];
    events.forEach((event, index) => {
      run.emit({ ...event, id: `sched.${tick}.${index}`, tick });
    });
    if (tick < total) run.advance();
  }
  return run.finish();
}

function lastSegmentEnd(segments: SchedSegment[], total: number): number {
  return segments.length > 0 ? segments[segments.length - 1]!.end : total;
}
