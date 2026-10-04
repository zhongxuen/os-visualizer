/**
 * `interleave(program, schedule)`: run a program under one schedule as a tick run, one
 * micro-op per tick, with the reason for every step.
 *
 * - **manual**: the picks say which thread runs on each tick. Only a thread that can make
 *   progress may be picked; the first pick that can't run ends the run with
 *   `sync.invalid`. When the picks run out first, the run just stops, and the last
 *   snapshot's `next` lists the threads that may be picked next.
 * - **rr**: threads take turns in index order, up to `quantum` ticks each. A thread that
 *   finishes, goes to sleep or yields gives up the CPU early. A spinner keeps its turn
 *   and spends it spinning. Finished and sleeping threads are skipped.
 * - **random**: each tick, a seeded random choice among the ready and spinning threads.
 *
 * Round robin and random stop when every thread has finished, when no thread can make
 * progress, or after `LIMITS.maxTicks` ticks.
 */

import type { CitationId } from '../citations/types';
import { createRun, type RunBuilder } from '../events/builder';
import { createRng } from '../sim/rng';
import type { SimResult } from '../sim/result';
import type { SyncEvent, SyncEventKind, SyncResult, SyncSnapshot } from './events';
import {
  allFinished,
  brokenBounds,
  initialMachine,
  isFinished,
  isStuck,
  meetsExpectations,
  nextOp,
  progressable,
  schedulable,
  statusOf,
  step,
  waitingOn,
  type Effect,
  type Machine,
} from './machine';
import { formatOp, LIMITS, threadName, type Program, type Schedule } from './program';

export type SyncRun = SimResult<SyncEvent>;

/** `counter = 0` or `count = 1, x = 2`. */
export function formatValues(values: Record<string, number>): string {
  return Object.entries(values)
    .map(([name, value]) => `${name} = ${value}`)
    .join(', ');
}

/** Why each waiting thread is waiting, e.g. "T1 waits for m (held by T0)". */
export function describeWaiting(program: Program, machine: Machine): string[] {
  return program.threads.flatMap((_, t) => {
    const status = statusOf(program, machine, t);
    const name = threadName(t);
    if (status === 'blocked') {
      const s = machine.sleeping[t]!;
      return [`${name} sleeps on ${s} (value ${machine.sems[s]!.value})`];
    }
    if (status === 'spinning') {
      const m = waitingOn(program, machine, t)!;
      const holder = machine.locks[m]!;
      if (holder === t) return [`${name} waits for ${m}, which it already holds`];
      const finished = isFinished(program, machine, holder);
      return [
        `${name} waits for ${m} (held by ${threadName(holder)}${
          finished ? ', which has finished and will never release it' : ''
        })`,
      ];
    }
    return [];
  });
}

/**
 * True when the run is stuck with two or more threads waiting and no lock wait is on a
 * finished holder: every waiting thread needs something only another waiting thread
 * could provide. A thread waiting for a lock a finished thread kept is stuck, not
 * deadlocked: there is no cycle, just a lock nobody will release.
 */
export function isDeadlock(program: Program, machine: Machine): boolean {
  if (!isStuck(program, machine)) return false;
  const waiting = program.threads.flatMap((_, t) => {
    const status = statusOf(program, machine, t);
    return status === 'blocked' || status === 'spinning' ? [t] : [];
  });
  if (waiting.length < 2) return false;
  return waiting.every((t) => {
    if (statusOf(program, machine, t) !== 'spinning') return true;
    const holder = machine.locks[waitingOn(program, machine, t)!]!;
    return !isFinished(program, machine, holder);
  });
}

function effectCitation(effect: Effect): CitationId {
  switch (effect.kind) {
    case 'lock':
    case 'spin':
    case 'unlock':
      return 'ostep.28.7';
    case 'error':
      return 'ostep.28.1';
    case 'wait':
    case 'block':
    case 'signal':
      return 'ostep.31.1';
    default:
      return 'ostep.26.4';
  }
}

interface Labelled {
  kind: SyncEventKind;
  label: string;
  lost?: boolean;
}

export interface InterleaveOptions {
  /** Ticks a round-robin or random run may take; `LIMITS.maxTicks` by default. */
  maxTicks?: number;
}

export function interleave(
  program: Program,
  schedule: Schedule,
  { maxTicks = LIMITS.maxTicks }: InterleaveOptions = {},
): SyncRun {
  const run: RunBuilder<SyncEvent> = createRun<SyncEvent>({ unit: 'tick' });
  let machine = initialMachine(program);
  const trace: number[] = [];
  let eventN = 0;
  let phaseN = 0;
  let lastThread: number | null = null;

  // Lost-update bookkeeping, for labels only: who stored to each variable, in order, and
  // how many stores each thread had seen when it last loaded it.
  const writers: Record<string, number[]> = Object.fromEntries(
    program.vars.map((v) => [v.name, []]),
  );
  const loadedAt: Record<string, number>[] = program.threads.map(() => ({}));

  const snapshot = (
    last: SyncSnapshot['last'],
    result: SyncResult | null,
  ): SyncSnapshot => {
    const copy = JSON.parse(JSON.stringify(machine)) as Machine;
    return {
      tick: run.position,
      pcs: copy.pcs,
      regs: copy.regs,
      status: program.threads.map((_, t) => statusOf(program, machine, t)),
      waitingOn: program.threads.map((_, t) => waitingOn(program, machine, t)),
      vars: copy.vars,
      locks: copy.locks,
      sems: copy.sems,
      trace: [...trace],
      last,
      next: result ? [] : progressable(program, machine),
      result,
    };
  };

  const emit = (
    kind: SyncEventKind,
    citation: CitationId,
    label: string,
    extra: { thread?: number; op?: number; lost?: boolean; detail?: string } = {},
    result: SyncResult | null = null,
  ) => {
    const last =
      extra.thread !== undefined && extra.op !== undefined
        ? { thread: extra.thread, op: extra.op }
        : null;
    run.emit({
      kind,
      id: `sync.${eventN++}`,
      label,
      citation,
      tick: run.position,
      ...(extra.detail === undefined ? {} : { detail: extra.detail }),
      ...(extra.thread === undefined ? {} : { thread: extra.thread }),
      ...(extra.op === undefined ? {} : { op: extra.op }),
      ...(extra.lost === undefined ? {} : { lost: extra.lost }),
      state: snapshot(last, result),
    });
  };

  const values = () => ({ ...machine.vars });

  const describe = (t: number, effect: Effect): Labelled => {
    const name = threadName(t);
    switch (effect.kind) {
      case 'load':
        return {
          kind: 'sync.load',
          label: `${name} loads ${effect.var} (${effect.value}) into its register ${effect.reg}. Nothing shared has changed yet.`,
        };
      case 'add':
        return {
          kind: 'sync.add',
          label: `${name} adds ${effect.k} to its register: ${effect.reg} = ${effect.value}. Only ${name}'s copy changed; shared memory has not.`,
        };
      case 'store': {
        const seen = loadedAt[t]![effect.var];
        const after = seen === undefined ? [] : writers[effect.var]!.slice(seen);
        const overwritten = [...new Set(after.filter((w) => w !== t))];
        const lost = overwritten.length > 0;
        let label = `${name} stores ${effect.reg} (${effect.value}) into ${effect.var}, which was ${effect.before}.`;
        if (lost) {
          const who = overwritten.map(threadName).join(' and ');
          label += ` ${who} stored to ${effect.var} after ${name} loaded it, so that update is lost.`;
        }
        const broken = brokenBounds(program, machine.vars).filter(
          (b) => b.var === effect.var,
        );
        for (const b of broken) {
          label +=
            b.value > b.max
              ? ` ${b.var} = ${b.value} is above its bound ${b.max}: overflow.`
              : ` ${b.var} = ${b.value} is below its bound ${b.min}: underflow.`;
        }
        return { kind: 'sync.store', label, lost };
      }
      case 'lock':
        return {
          kind: 'sync.lock',
          label: `${name} runs test-and-set on ${effect.m}: it returns 0 (free), so ${name} now holds ${effect.m}.`,
        };
      case 'spin':
        return {
          kind: 'sync.spin',
          label:
            effect.holder === t
              ? `${name} runs test-and-set on ${effect.m}: it returns 1 because ${name} already holds it, so ${name} spins forever.`
              : `${name} runs test-and-set on ${effect.m}: it returns 1 because ${threadName(effect.holder)} holds it, so ${name} spins and will try again.`,
        };
      case 'unlock':
        return {
          kind: 'sync.unlock',
          label: `${name} releases ${effect.m}: it is free again.`,
        };
      case 'wait':
        return {
          kind: 'sync.wait',
          label: `${name} waits on ${effect.s}: the value was above 0, so it drops to ${effect.value} and ${name} carries on.`,
        };
      case 'block':
        return {
          kind: 'sync.block',
          label: `${name} waits on ${effect.s}: the value is 0, so ${name} goes to sleep in ${effect.s}'s queue.`,
        };
      case 'signal':
        return {
          kind: 'sync.signal',
          label:
            effect.woke === null
              ? `${name} signals ${effect.s}: nobody is waiting, so the value goes up to ${effect.value}.`
              : `${name} signals ${effect.s}: ${threadName(effect.woke)} was first in the queue, so it wakes and completes its wait. The value stays ${effect.value}.`,
        };
      case 'yield':
        return { kind: 'sync.yield', label: `${name} yields the CPU.` };
      case 'error':
        return {
          kind: 'sync.error',
          label: `${name} releases ${effect.m}, which it does not hold${
            effect.holder === null ? '' : ` (${threadName(effect.holder)} does)`
          }: an error, so the run stops.`,
        };
    }
  };

  const finishedLabel = (t: number) => ({
    kind: 'sync.done' as const,
    label: `${threadName(t)} has run all its ops and finished.`,
  });

  /** Run one tick of thread `t`. Returns false when the run must stop (an error). */
  const exec = (t: number): boolean => {
    run.advance();
    if (t !== lastThread) {
      const op = nextOp(program, machine, t);
      run.phase(
        `run-${phaseN++}`,
        `${threadName(t)} runs`,
        `${threadName(t)} gets the CPU. Its next op is ${op ? formatOp(op) : 'nothing'}.`,
      );
      lastThread = t;
    }
    trace.push(t);
    const before = machine;
    const { machine: after, effect, op } = step(program, machine, t);
    const described = describe(t, effect);
    if (effect.kind === 'error') {
      emit(
        described.kind,
        effectCitation(effect),
        described.label,
        { thread: t, op },
        { kind: 'error', correct: null, values: values() },
      );
      return false;
    }
    machine = after;
    if (effect.kind === 'load') {
      loadedAt[t]![effect.var] = writers[effect.var]!.length;
    }
    emit(described.kind, effectCitation(effect), described.label, {
      thread: t,
      op,
      ...(described.kind === 'sync.store' ? { lost: described.lost ?? false } : {}),
    });
    if (effect.kind === 'store') writers[effect.var]!.push(t);
    for (const u of [t, effect.kind === 'signal' ? effect.woke : null]) {
      if (
        u !== null &&
        isFinished(program, machine, u) &&
        !isFinished(program, before, u)
      ) {
        const done = finishedLabel(u);
        emit(done.kind, 'ostep.26', done.label, { thread: u });
      }
    }
    return true;
  };

  const endLabel = (): { label: string; correct: boolean } => {
    const correct = meetsExpectations(program, machine.vars);
    const now = formatValues(machine.vars);
    if (program.expect.length === 0) {
      return { label: `Every thread has finished: ${now}.`, correct };
    }
    if (correct) {
      return { label: `Every thread has finished: ${now}, as expected.`, correct };
    }
    const wrong = program.expect
      .filter((e) => machine.vars[e.var] !== e.value)
      .map((e) => {
        const actual = machine.vars[e.var]!;
        const gap = e.value - actual;
        const lostText =
          gap > 0 && program.vars.length === 1
            ? `: ${gap} ${gap === 1 ? 'update was' : 'updates were'} lost`
            : '';
        return `${e.var} = ${actual} where ${e.value} is correct${lostText}`;
      });
    return {
      label: `Every thread has finished, but ${wrong.join('; ')}.`,
      correct,
    };
  };

  /** Emit the closing event if the run is over. Returns true when it was. */
  const close = (): boolean => {
    if (allFinished(program, machine)) {
      const { label, correct } = endLabel();
      emit(
        'sync.end',
        correct ? 'ostep.26.5' : 'ostep.26.4',
        label,
        {},
        {
          kind: 'done',
          correct,
          values: values(),
        },
      );
      return true;
    }
    if (isStuck(program, machine)) {
      const why = describeWaiting(program, machine).join('; ');
      const deadlock = isDeadlock(program, machine);
      emit(
        'sync.stuck',
        'ostep.32.3',
        `No thread can move: ${why}.${deadlock ? ' Each waits for something only another waiting thread could provide: a deadlock.' : ''}`,
        {},
        { kind: 'stuck', correct: null, values: values() },
      );
      return true;
    }
    return false;
  };

  run.phase(
    'start',
    'Start',
    `${program.threads.length} ${program.threads.length === 1 ? 'thread' : 'threads'} share ${formatValues(machine.vars)}. Nothing has run yet.`,
  );
  emit('sync.start', 'ostep.26', `Nothing has run yet: ${formatValues(machine.vars)}.`);

  const limitReached = () => {
    if (run.position < maxTicks) return false;
    emit(
      'sync.limit',
      'ostep.26.4',
      `The run stopped after ${maxTicks} ticks without finishing.`,
      {},
      { kind: 'limit', correct: null, values: values() },
    );
    return true;
  };

  switch (schedule.kind) {
    case 'manual': {
      for (const pick of schedule.picks) {
        if (close()) return run.finish();
        const can = progressable(program, machine);
        if (!can.includes(pick)) {
          emit(
            'sync.invalid',
            'ostep.26.4',
            invalidLabel(program, machine, pick),
            pick < program.threads.length ? { thread: pick } : {},
            { kind: 'invalid', correct: null, values: values() },
          );
          return run.finish();
        }
        if (!exec(pick)) return run.finish();
      }
      close();
      return run.finish();
    }
    case 'rr': {
      let current = -1;
      let used = 0;
      for (;;) {
        if (close() || limitReached()) return run.finish();
        const can = schedulable(program, machine);
        let t: number;
        if (current >= 0 && used < schedule.quantum && can.includes(current)) {
          t = current;
        } else {
          t = can.find((u) => u > current) ?? can[0]!;
          used = 0;
        }
        current = t;
        used += 1;
        const op = nextOp(program, machine, t);
        if (!exec(t)) return run.finish();
        const status = statusOf(program, machine, t);
        if (status === 'done' || status === 'blocked' || op?.op === 'yield') {
          used = schedule.quantum;
        }
      }
    }
    case 'random': {
      const rng = createRng(schedule.seed);
      for (;;) {
        if (close() || limitReached()) return run.finish();
        const can = schedulable(program, machine);
        const t = can[rng.int(can.length)]!;
        if (!exec(t)) return run.finish();
      }
    }
  }
}

function invalidLabel(program: Program, machine: Machine, pick: number): string {
  if (pick >= program.threads.length) return `There is no thread ${threadName(pick)}.`;
  const name = threadName(pick);
  const status = statusOf(program, machine, pick);
  if (status === 'done') return `${name} can't run: it has finished.`;
  const [why] = describeWaiting(program, machine).filter((w) => w.startsWith(`${name} `));
  return `${name} can't run: ${why ?? `${name} is waiting`}.`;
}

/** The last snapshot of a run. */
export function finalState(run: SyncRun): SyncSnapshot {
  const last = run.events.at(-1);
  if (!last) throw new Error('empty run');
  return last.state;
}

const NOT_A_PICK = new Set<SyncEventKind>([
  'sync.start',
  'sync.spin',
  'sync.done',
  'sync.end',
  'sync.stuck',
  'sync.invalid',
  'sync.error',
  'sync.limit',
]);

/**
 * The run as a manual schedule: the thread behind every op that changed something.
 * Spins are left out (a spin changes nothing, and a manual pick must make progress), so
 * replaying the picks reaches the same state.
 */
export function effectivePicks(run: SyncRun): number[] {
  return run.events.flatMap((e) =>
    NOT_A_PICK.has(e.kind) || e.thread === undefined ? [] : [e.thread],
  );
}

/** Threads a manual schedule may pick after `picks`; empty once the run is over. */
export function nextPicks(program: Program, picks: readonly number[]): number[] {
  return finalState(interleave(program, { kind: 'manual', picks: [...picks] })).next;
}
