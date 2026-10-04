/**
 * A synchronisation program: a few threads, each a list of micro-ops over shared
 * variables, locks and semaphores, with a Zod schema and hard limits.
 *
 * Every op takes one tick:
 *
 * - `load r, x` copies shared variable `x` into the thread's register `r`;
 * - `add r, k` adds `k` to the register (shared memory is not touched);
 * - `store x, r` writes the register back to `x`;
 * - `lock m` / `unlock m` acquire and release a test-and-set mutex (OSTEP §28.7);
 * - `wait s` / `signal s` are P and V on a semaphore (OSTEP §31);
 * - `yield` gives up the CPU.
 *
 * Threads are named by position, `T0`, `T1`, …, so the schema stores only their ops.
 * `zod/mini` for the same reason as the share-state codec: it is validated in the browser
 * and the full Zod API would cost the route its JS budget.
 */

import * as z from 'zod/mini';

export const LIMITS = {
  minThreads: 1,
  maxThreads: 3,
  minOps: 1,
  maxOps: 16,
  minVars: 1,
  maxVars: 4,
  maxLocks: 2,
  maxSems: 3,
  /** Largest magnitude of a variable's initial value or an `add` constant. */
  maxValue: 99,
  /** Largest initial semaphore value. */
  maxSemInit: 10,
  /** Most picks a manual schedule keeps. */
  maxPicks: 200,
  /** Ticks a round-robin or random run may take before it is stopped. */
  maxTicks: 300,
} as const;

export type Op =
  | { op: 'load'; reg: string; var: string }
  | { op: 'add'; reg: string; k: number }
  | { op: 'store'; var: string; reg: string }
  | { op: 'lock'; m: string }
  | { op: 'unlock'; m: string }
  | { op: 'wait'; s: string }
  | { op: 'signal'; s: string }
  | { op: 'yield' };

export type OpKind = Op['op'];

export interface Thread {
  ops: Op[];
}

export interface VarDecl {
  name: string;
  init: number;
}

export interface SemDecl {
  name: string;
  init: number;
}

/** The value a variable must end with for the run to be correct. */
export interface Expectation {
  var: string;
  value: number;
}

/** A range a variable must stay inside at every tick (a buffer's count, 0..size). */
export interface Bound {
  var: string;
  min: number;
  max: number;
}

export interface Program {
  vars: VarDecl[];
  locks: string[];
  sems: SemDecl[];
  threads: Thread[];
  expect: Expectation[];
  bounds: Bound[];
}

export interface ValidationIssue {
  path: (string | number)[];
  message: string;
}

export type Validation<T> =
  { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

export function threadName(t: number): string {
  return `T${t}`;
}

/** `load r, counter`, `add r, -1`, `lock m`, `wait empty`, `yield`. */
export function formatOp(op: Op): string {
  switch (op.op) {
    case 'load':
      return `load ${op.reg}, ${op.var}`;
    case 'add':
      return `add ${op.reg}, ${op.k}`;
    case 'store':
      return `store ${op.var}, ${op.reg}`;
    case 'lock':
      return `lock ${op.m}`;
    case 'unlock':
      return `unlock ${op.m}`;
    case 'wait':
      return `wait ${op.s}`;
    case 'signal':
      return `signal ${op.s}`;
    case 'yield':
      return 'yield';
  }
}

/** Registers a thread uses, in order of first use. */
export function registersOf(thread: Thread): string[] {
  const regs: string[] = [];
  for (const op of thread.ops) {
    if ('reg' in op && !regs.includes(op.reg)) regs.push(op.reg);
  }
  return regs;
}

const NAME = z
  .string('A name must be text')
  .check(
    z.regex(
      /^[A-Za-z][A-Za-z0-9_]{0,11}$/,
      'A name is a letter followed by up to 11 letters, digits or underscores',
    ),
  );

function int(min: number, max: number, what: string) {
  return z
    .int(`${what} must be a whole number`)
    .check(
      z.gte(min, `${what} must be at least ${min}`),
      z.lte(max, `${what} must be at most ${max}`),
    );
}

const VALUE = int(-LIMITS.maxValue, LIMITS.maxValue, 'A value');

const OP_SCHEMA = z.discriminatedUnion('op', [
  z.object({ op: z.literal('load'), reg: NAME, var: NAME }),
  z.object({ op: z.literal('add'), reg: NAME, k: VALUE }),
  z.object({ op: z.literal('store'), var: NAME, reg: NAME }),
  z.object({ op: z.literal('lock'), m: NAME }),
  z.object({ op: z.literal('unlock'), m: NAME }),
  z.object({ op: z.literal('wait'), s: NAME }),
  z.object({ op: z.literal('signal'), s: NAME }),
  z.object({ op: z.literal('yield') }),
]);

/** What is wrong with a program whose fields each parse: names and references. */
export function programIssues(program: Program): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const kinds = new Map<string, string>();
  const declare = (name: string, kind: string, path: (string | number)[]) => {
    const seen = kinds.get(name);
    if (seen) {
      issues.push({ path, message: `${name} is already the name of a ${seen}` });
    } else {
      kinds.set(name, kind);
    }
  };
  program.vars.forEach((v, i) => declare(v.name, 'variable', ['vars', i, 'name']));
  program.locks.forEach((m, i) => declare(m, 'lock', ['locks', i]));
  program.sems.forEach((s, i) => declare(s.name, 'semaphore', ['sems', i, 'name']));

  const vars = new Set(program.vars.map((v) => v.name));
  const locks = new Set(program.locks);
  const sems = new Set(program.sems.map((s) => s.name));
  const need = (
    set: Set<string>,
    name: string,
    kind: string,
    path: (string | number)[],
  ) => {
    if (!set.has(name))
      issues.push({ path, message: `There is no ${kind} called ${name}` });
  };

  program.threads.forEach((thread, t) =>
    thread.ops.forEach((op, i) => {
      const path = ['threads', t, 'ops', i];
      if (op.op === 'load' || op.op === 'store') need(vars, op.var, 'variable', path);
      if (op.op === 'lock' || op.op === 'unlock') need(locks, op.m, 'lock', path);
      if (op.op === 'wait' || op.op === 'signal') need(sems, op.s, 'semaphore', path);
    }),
  );
  program.expect.forEach((e, i) => need(vars, e.var, 'variable', ['expect', i]));
  program.bounds.forEach((b, i) => {
    need(vars, b.var, 'variable', ['bounds', i]);
    if (b.min > b.max) {
      issues.push({
        path: ['bounds', i],
        message: `The bound on ${b.var} has min ${b.min} above max ${b.max}`,
      });
    }
  });
  return issues;
}

export const PROGRAM_SCHEMA = z
  .object({
    vars: z
      .array(z.object({ name: NAME, init: VALUE }))
      .check(
        z.minLength(LIMITS.minVars, 'Declare at least one shared variable'),
        z.maxLength(LIMITS.maxVars, `At most ${LIMITS.maxVars} shared variables`),
      ),
    locks: z
      .array(NAME)
      .check(z.maxLength(LIMITS.maxLocks, `At most ${LIMITS.maxLocks} locks`)),
    sems: z
      .array(z.object({ name: NAME, init: int(0, LIMITS.maxSemInit, 'A semaphore') }))
      .check(z.maxLength(LIMITS.maxSems, `At most ${LIMITS.maxSems} semaphores`)),
    threads: z
      .array(
        z.object({
          ops: z
            .array(OP_SCHEMA)
            .check(
              z.minLength(LIMITS.minOps, 'A thread needs at least one op'),
              z.maxLength(LIMITS.maxOps, `A thread has at most ${LIMITS.maxOps} ops`),
            ),
        }),
      )
      .check(
        z.minLength(LIMITS.minThreads, 'Add at least one thread'),
        z.maxLength(LIMITS.maxThreads, `At most ${LIMITS.maxThreads} threads`),
      ),
    expect: z
      .array(z.object({ var: NAME, value: VALUE }))
      .check(z.maxLength(LIMITS.maxVars)),
    bounds: z
      .array(z.object({ var: NAME, min: VALUE, max: VALUE }))
      .check(z.maxLength(LIMITS.maxVars)),
  })
  .check(
    z.superRefine<Program>((value, ctx) => {
      for (const issue of programIssues(value)) {
        ctx.addIssue({
          code: 'custom',
          message: issue.message,
          path: issue.path,
          input: value,
        });
      }
    }),
  ) as unknown as z.ZodMiniType<Program>;

export function validateProgram(input: unknown): Validation<Program> {
  const parsed = PROGRAM_SCHEMA.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.map((part) => (typeof part === 'number' ? part : String(part))),
      message: issue.message,
    })),
  };
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

export type Schedule =
  /** The thread to run on each tick, chosen by hand (keys 1, 2, 3). */
  | { kind: 'manual'; picks: number[] }
  /** Threads take turns in index order, `quantum` ticks each. */
  | { kind: 'rr'; quantum: number }
  /** Each tick, a seeded random choice among the threads that can be scheduled. */
  | { kind: 'random'; seed: number };

export type ScheduleKind = Schedule['kind'];

export const SCHEDULE_KINDS = ['manual', 'rr', 'random'] as const;

export const SCHEDULE_NAMES: Record<ScheduleKind, string> = {
  manual: 'Manual',
  rr: 'Round robin',
  random: 'Seeded random',
};

export const MAX_QUANTUM = 8;
export const MAX_SEED = 0xffff_ffff;

export const SCHEDULE_SCHEMA = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('manual'),
    picks: z
      .array(int(0, LIMITS.maxThreads - 1, 'A pick'))
      .check(z.maxLength(LIMITS.maxPicks, `At most ${LIMITS.maxPicks} picks`)),
  }),
  z.object({ kind: z.literal('rr'), quantum: int(1, MAX_QUANTUM, 'The quantum') }),
  z.object({ kind: z.literal('random'), seed: int(0, MAX_SEED, 'The seed') }),
]) as unknown as z.ZodMiniType<Schedule>;

export function describeSchedule(schedule: Schedule): string {
  switch (schedule.kind) {
    case 'manual':
      return `Manual, ${schedule.picks.length} ${schedule.picks.length === 1 ? 'pick' : 'picks'}`;
    case 'rr':
      return `Round robin, quantum ${schedule.quantum}`;
    case 'random':
      return `Seeded random, seed ${schedule.seed}`;
  }
}
