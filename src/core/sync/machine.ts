/**
 * The machine a synchronisation program runs on: one CPU, per-thread program counters
 * and registers, shared variables, test-and-set mutexes and semaphores with FIFO wait
 * queues. `step` runs one micro-op of one thread and is the only place the semantics
 * live; `interleave` and `explore` both drive it.
 *
 * - **Mutex** (OSTEP §28.7): `lock m` runs test-and-set. If `m` was free the thread now
 *   holds it and moves on; if it was held the thread *spins*: the tick is spent, nothing
 *   changes, and the same `lock` runs again next time.
 * - **Semaphore** (OSTEP §31): the value never goes negative. `wait s` with a positive
 *   value decrements it and moves on; with 0 the thread sleeps in `s`'s FIFO queue.
 *   `signal s` wakes the head of the queue, which completes its wait (the value stays
 *   the same), or increments the value when nobody is waiting.
 *
 * Plain JSON throughout, so a machine can be copied into an event snapshot and used as
 * a memo key.
 */

import type { Op, Program } from './program';
import { registersOf } from './program';

export type ThreadStatus = 'ready' | 'spinning' | 'blocked' | 'done';

export interface SemState {
  value: number;
  /** Sleeping threads, head first. */
  queue: number[];
  /** Signals so far. */
  signals: number;
  /** Waits that completed so far (passed at once or woken). */
  waits: number;
}

export interface Machine {
  /** Index of the next op per thread; `ops.length` once the thread has finished. */
  pcs: number[];
  /** Each thread's private registers. */
  regs: Record<string, number>[];
  /** The semaphore a thread sleeps on, or `null`. */
  sleeping: (string | null)[];
  vars: Record<string, number>;
  /** Who holds each mutex, or `null` when free. */
  locks: Record<string, number | null>;
  sems: Record<string, SemState>;
}

/** What one step did. */
export type Effect =
  | { kind: 'load'; var: string; reg: string; value: number }
  | { kind: 'add'; reg: string; k: number; value: number }
  | { kind: 'store'; var: string; reg: string; value: number; before: number }
  | { kind: 'lock'; m: string }
  | { kind: 'spin'; m: string; holder: number }
  | { kind: 'unlock'; m: string }
  | { kind: 'wait'; s: string; value: number }
  | { kind: 'block'; s: string }
  | { kind: 'signal'; s: string; woke: number | null; value: number }
  | { kind: 'yield' }
  /** `unlock` of a mutex the thread does not hold. The machine is unchanged. */
  | { kind: 'error'; m: string; holder: number | null };

export interface StepResult {
  machine: Machine;
  effect: Effect;
  /** The index of the op that ran. */
  op: number;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function initialMachine(program: Program): Machine {
  return {
    pcs: program.threads.map(() => 0),
    regs: program.threads.map((thread) =>
      Object.fromEntries(registersOf(thread).map((reg) => [reg, 0])),
    ),
    sleeping: program.threads.map(() => null),
    vars: Object.fromEntries(program.vars.map((v) => [v.name, v.init])),
    locks: Object.fromEntries(program.locks.map((m) => [m, null])),
    sems: Object.fromEntries(
      program.sems.map((s) => [
        s.name,
        { value: s.init, queue: [], signals: 0, waits: 0 },
      ]),
    ),
  };
}

export function nextOp(program: Program, machine: Machine, t: number): Op | null {
  return program.threads[t]!.ops[machine.pcs[t]!] ?? null;
}

export function isFinished(program: Program, machine: Machine, t: number): boolean {
  return machine.pcs[t]! >= program.threads[t]!.ops.length;
}

/**
 * `done` past its last op; `blocked` asleep on a semaphore; `spinning` when its next op
 * is `lock` on a mutex someone holds (running it would only spin); else `ready`.
 */
export function statusOf(program: Program, machine: Machine, t: number): ThreadStatus {
  if (isFinished(program, machine, t)) return 'done';
  if (machine.sleeping[t] !== null) return 'blocked';
  const op = nextOp(program, machine, t);
  if (op?.op === 'lock' && machine.locks[op.m] !== null) return 'spinning';
  return 'ready';
}

/** The lock or semaphore a thread is waiting for, or `null`. */
export function waitingOn(program: Program, machine: Machine, t: number): string | null {
  const status = statusOf(program, machine, t);
  if (status === 'blocked') return machine.sleeping[t]!;
  if (status === 'spinning') {
    const op = nextOp(program, machine, t);
    return op?.op === 'lock' ? op.m : null;
  }
  return null;
}

/** Threads whose next step changes something: ready ones. */
export function progressable(program: Program, machine: Machine): number[] {
  return program.threads.flatMap((_, t) =>
    statusOf(program, machine, t) === 'ready' ? [t] : [],
  );
}

/** Threads a scheduler may give the CPU: ready ones and spinners. */
export function schedulable(program: Program, machine: Machine): number[] {
  return program.threads.flatMap((_, t) => {
    const status = statusOf(program, machine, t);
    return status === 'ready' || status === 'spinning' ? [t] : [];
  });
}

export function allFinished(program: Program, machine: Machine): boolean {
  return program.threads.every((_, t) => isFinished(program, machine, t));
}

/** No thread can make progress, and not every thread has finished. */
export function isStuck(program: Program, machine: Machine): boolean {
  return !allFinished(program, machine) && progressable(program, machine).length === 0;
}

/**
 * Run the next op of thread `t`. Expects a thread that has not finished and is not
 * asleep; a spinner may be stepped (it spins).
 */
export function step(program: Program, machine: Machine, t: number): StepResult {
  const op = nextOp(program, machine, t);
  if (op === null) throw new Error(`T${t} has finished`);
  if (machine.sleeping[t] !== null) throw new Error(`T${t} is asleep`);

  const opIndex = machine.pcs[t]!;
  const next = clone(machine);
  const regs = next.regs[t]!;
  const advance = () => {
    next.pcs[t] = opIndex + 1;
  };

  let effect: Effect;
  switch (op.op) {
    case 'load': {
      const value = next.vars[op.var]!;
      regs[op.reg] = value;
      advance();
      effect = { kind: 'load', var: op.var, reg: op.reg, value };
      break;
    }
    case 'add': {
      const value = (regs[op.reg] ?? 0) + op.k;
      regs[op.reg] = value;
      advance();
      effect = { kind: 'add', reg: op.reg, k: op.k, value };
      break;
    }
    case 'store': {
      const before = next.vars[op.var]!;
      const value = regs[op.reg] ?? 0;
      next.vars[op.var] = value;
      advance();
      effect = { kind: 'store', var: op.var, reg: op.reg, value, before };
      break;
    }
    case 'lock': {
      const holder = next.locks[op.m]!;
      if (holder === null) {
        next.locks[op.m] = t;
        advance();
        effect = { kind: 'lock', m: op.m };
      } else {
        // Test-and-set returned 1: the tick is spent and nothing changes.
        return { machine, effect: { kind: 'spin', m: op.m, holder }, op: opIndex };
      }
      break;
    }
    case 'unlock': {
      const holder = next.locks[op.m]!;
      if (holder !== t) {
        return { machine, effect: { kind: 'error', m: op.m, holder }, op: opIndex };
      }
      next.locks[op.m] = null;
      advance();
      effect = { kind: 'unlock', m: op.m };
      break;
    }
    case 'wait': {
      const sem = next.sems[op.s]!;
      if (sem.value > 0) {
        sem.value -= 1;
        sem.waits += 1;
        advance();
        effect = { kind: 'wait', s: op.s, value: sem.value };
      } else {
        // The pc stays on the wait; `signal` moves it on when it wakes the thread.
        sem.queue.push(t);
        next.sleeping[t] = op.s;
        effect = { kind: 'block', s: op.s };
      }
      break;
    }
    case 'signal': {
      const sem = next.sems[op.s]!;
      sem.signals += 1;
      const woke = sem.queue.shift() ?? null;
      if (woke === null) {
        sem.value += 1;
      } else {
        next.sleeping[woke] = null;
        next.pcs[woke] = next.pcs[woke]! + 1;
        sem.waits += 1;
      }
      advance();
      effect = { kind: 'signal', s: op.s, woke, value: sem.value };
      break;
    }
    case 'yield':
      advance();
      effect = { kind: 'yield' };
      break;
  }
  return { machine: next, effect, op: opIndex };
}

/** Each expectation holds in `vars`. */
export function meetsExpectations(
  program: Program,
  vars: Record<string, number>,
): boolean {
  return program.expect.every((e) => vars[e.var] === e.value);
}

/** The bounds broken by `vars`, as `{ var, value, min, max }`. */
export function brokenBounds(program: Program, vars: Record<string, number>) {
  return program.bounds.flatMap((b) => {
    const value = vars[b.var]!;
    return value < b.min || value > b.max ? [{ ...b, value }] : [];
  });
}
