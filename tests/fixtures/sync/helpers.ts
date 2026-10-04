import fc from 'fast-check';

import {
  finalState,
  interleave,
  type Op,
  type Program,
  type Schedule,
  type SyncRun,
} from '@/core/sync';

export function run(program: Program, schedule: Schedule) {
  const result = interleave(program, schedule);
  return { result, state: finalState(result) };
}

export function manual(program: Program, ...picks: number[]) {
  return run(program, { kind: 'manual', picks });
}

export function kinds(result: SyncRun): string[] {
  return result.events.map((e) => e.kind);
}

/** A program over `x`, mutex `m` and semaphore `s`, with the given thread ops. */
export function programOf(ops: Op[][], semInit = 0): Program {
  return {
    vars: [{ name: 'x', init: 0 }],
    locks: ['m'],
    sems: [{ name: 's', init: semInit }],
    threads: ops.map((list) => ({ ops: list })),
    expect: [],
    bounds: [],
  };
}

const plainOp: fc.Arbitrary<Op> = fc.oneof(
  fc.constant<Op>({ op: 'load', reg: 'r', var: 'x' }),
  fc.integer({ min: -2, max: 2 }).map<Op>((k) => ({ op: 'add', reg: 'r', k })),
  fc.constant<Op>({ op: 'store', var: 'x', reg: 'r' }),
  fc.constant<Op>({ op: 'wait', s: 's' }),
  fc.constant<Op>({ op: 'signal', s: 's' }),
  fc.constant<Op>({ op: 'yield' }),
);

/** Any op at all, including a bare lock or unlock (so errors and self-deadlock happen). */
export const anyOp: fc.Arbitrary<Op> = fc.oneof(
  plainOp,
  fc.constant<Op>({ op: 'lock', m: 'm' }),
  fc.constant<Op>({ op: 'unlock', m: 'm' }),
);

/** Ops where every lock is paired with an unlock around a critical section. */
const wellFormedThread: fc.Arbitrary<Op[]> = fc
  .array(
    fc.oneof(
      plainOp.map((op) => [op]),
      fc
        .array(plainOp, { minLength: 0, maxLength: 2 })
        .map((body) => [
          { op: 'lock', m: 'm' } as Op,
          ...body,
          { op: 'unlock', m: 'm' } as Op,
        ]),
    ),
    { minLength: 1, maxLength: 4 },
  )
  .map((blocks) => blocks.flat().slice(0, 16));

/** Small programs for the oracle: 1–2 threads of 1–6 arbitrary ops. */
export const smallProgram: fc.Arbitrary<Program> = fc
  .record({
    threads: fc.array(fc.array(anyOp, { minLength: 1, maxLength: 6 }), {
      minLength: 1,
      maxLength: 2,
    }),
    semInit: fc.integer({ min: 0, max: 1 }),
  })
  .map(({ threads, semInit }) => programOf(threads, semInit));

/** Programs with well-formed critical sections, 1–3 threads. */
export const lockedProgram: fc.Arbitrary<Program> = fc
  .record({
    threads: fc.array(wellFormedThread, { minLength: 1, maxLength: 3 }),
    semInit: fc.integer({ min: 0, max: 2 }),
  })
  .map(({ threads, semInit }) => programOf(threads, semInit));

export const schedule: fc.Arbitrary<Schedule> = fc.oneof(
  fc.integer({ min: 1, max: 8 }).map<Schedule>((quantum) => ({ kind: 'rr', quantum })),
  fc.nat({ max: 0xffff_ffff }).map<Schedule>((seed) => ({ kind: 'random', seed })),
);
