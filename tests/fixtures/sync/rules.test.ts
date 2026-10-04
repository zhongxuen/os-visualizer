import { describe, expect, it } from 'vitest';

import {
  counterProgram,
  effectivePicks,
  explore,
  interleave,
  LIMITS,
  nextPicks,
  presetById,
  SYNC_RULES,
  type Op,
} from '@/core/sync';

import { kinds, manual, programOf, run } from './helpers';

/**
 * One test per rule in `src/core/sync/rules.ts`, named after the rule id. The last test
 * checks the list and the tests stay in step.
 */

const TESTED = new Set<string>();
function rule(id: string, body: () => void) {
  TESTED.add(id);
  it(id, body);
}

const L = (m = 'm'): Op => ({ op: 'lock', m });
const U = (m = 'm'): Op => ({ op: 'unlock', m });
const W: Op = { op: 'wait', s: 's' };
const S: Op = { op: 'signal', s: 's' };
const Y: Op = { op: 'yield' };
const LOAD: Op = { op: 'load', reg: 'r', var: 'x' };
const ADD: Op = { op: 'add', reg: 'r', k: 5 };
const STORE: Op = { op: 'store', var: 'x', reg: 'r' };

describe('synchronisation rules', () => {
  rule('sync.tick', () => {
    const { result } = manual(counterProgram(), 0, 1, 0, 1, 0, 1);
    const ops = result.events.filter(
      (e) => e.thread !== undefined && e.kind !== 'sync.done',
    );
    // One op per tick, ticks 1..6, alternating threads.
    expect(ops.map((e) => [e.tick, e.thread])).toEqual([
      [1, 0],
      [2, 1],
      [3, 0],
      [4, 1],
      [5, 0],
      [6, 1],
    ]);
    expect(result.durationMs).toBe(6000);
  });

  rule('sync.registers', () => {
    const program = programOf([[LOAD, ADD, STORE], [LOAD]]);
    const { result } = manual(program, 0, 0);
    // After the add, only T0's register changed.
    expect(result.events.at(-1)!.state.regs).toEqual([{ r: 5 }, { r: 0 }]);
    expect(result.events.at(-1)!.state.vars).toEqual({ x: 0 });
    const done = manual(program, 0, 0, 0, 1);
    expect(done.state.vars).toEqual({ x: 5 });
    expect(done.state.regs).toEqual([{ r: 5 }, { r: 5 }]);
  });

  rule('sync.tas', () => {
    const program = programOf([
      [L(), U()],
      [L(), U()],
    ]);
    const { result } = run(program, { kind: 'rr', quantum: 1 });
    expect(kinds(result).slice(1, 4)).toEqual(['sync.lock', 'sync.spin', 'sync.unlock']);
    const spin = result.events[2]!;
    expect(spin.label).toMatch(/test-and-set on m: it returns 1 because T0 holds it/);
    expect(spin.state.pcs).toEqual([1, 0]);
    expect(spin.state.locks).toEqual({ m: 0 });
    expect(result.events.at(-1)!.state.result!.kind).toBe('done');
  });

  rule('sync.unlock.owner', () => {
    const program = programOf([[U()], [L()]]);
    const { state, result } = manual(program, 0);
    expect(state.result).toMatchObject({ kind: 'error' });
    expect(result.events.at(-1)!.label).toMatch(/releases m, which it does not hold/);
    // The other order: T1 holds m, T0's unlock is still not its own.
    expect(manual(program, 1, 0).result.events.at(-1)!.label).toMatch(/\(T1 does\)/);
  });

  rule('sync.sem.value', () => {
    const program = programOf([[W, W], [W]], 1);
    const { result, state } = manual(program, 0, 1, 0);
    expect(kinds(result).slice(1)).toEqual([
      'sync.wait',
      'sync.block',
      'sync.block',
      'sync.stuck',
    ]);
    expect(state.sems.s).toEqual({ value: 0, queue: [1, 0], signals: 0, waits: 1 });
    expect(state.status).toEqual(['blocked', 'blocked']);
  });

  rule('sync.sem.signal', () => {
    const program = programOf([[W], [S, S]]);
    const { result, state } = manual(program, 0, 1, 1);
    const signals = result.events.filter((e) => e.kind === 'sync.signal');
    expect(signals[0]!.label).toMatch(/T0 was first in the queue, so it wakes/);
    expect(signals[0]!.state.sems.s.value).toBe(0);
    expect(signals[1]!.label).toMatch(/nobody is waiting, so the value goes up to 1/);
    expect(state.sems.s).toEqual({ value: 1, queue: [], signals: 2, waits: 1 });
    // T0's wait completed when it was woken: it finished without running again.
    expect(state.status).toEqual(['done', 'done']);
  });

  rule('sync.manual', () => {
    const program = counterProgram(0, true);
    // T0 holds m; T1 would spin, so it can't be picked.
    expect(nextPicks(program, [0])).toEqual([0]);
    const { state, result } = manual(program, 0, 1, 0);
    expect(state.result!.kind).toBe('invalid');
    expect(result.events.at(-1)!.label).toBe(
      "T1 can't run: T1 waits for m (held by T0).",
    );
    expect(manual(program, 2).result.events.at(-1)!.label).toBe('There is no thread T2.');
    // Picks that run out just stop: no closing event, next picks listed.
    const partial = manual(program, 0, 0);
    expect(partial.state.result).toBeNull();
    expect(partial.state.next).toEqual([0]);
  });

  rule('sync.rr', () => {
    const program = programOf([
      [LOAD, Y, ADD, STORE],
      [LOAD, ADD],
    ]);
    const picks = effectivePicks(interleave(program, { kind: 'rr', quantum: 3 }));
    // T0 yields after 2 ticks; T1 runs both its ops and finishes; T0 finishes.
    expect(picks).toEqual([0, 0, 1, 1, 0, 0]);

    // A spinner keeps its turn: with quantum 3, T1 spins 3 times while T0 holds m.
    const locked = programOf([
      [L(), LOAD, LOAD, LOAD, LOAD, U()],
      [L(), U()],
    ]);
    const result = interleave(locked, { kind: 'rr', quantum: 3 });
    expect(
      result.events
        .filter((e) => e.thread !== undefined)
        .map((e) => e.kind)
        .slice(0, 6),
    ).toEqual([
      'sync.lock',
      'sync.load',
      'sync.load',
      'sync.spin',
      'sync.spin',
      'sync.spin',
    ]);
  });

  rule('sync.random', () => {
    const program = counterProgram(0, true);
    const a = interleave(program, { kind: 'random', seed: 7 });
    expect(interleave(program, { kind: 'random', seed: 7 })).toStrictEqual(a);
    const traces = new Set(
      Array.from({ length: 20 }, (_, seed) =>
        JSON.stringify(
          interleave(program, { kind: 'random', seed }).events.at(-1)!.state.trace,
        ),
      ),
    );
    expect(traces.size).toBeGreaterThan(1);
    // Spinners are scheduled too.
    expect(
      Array.from({ length: 20 }, (_, seed) =>
        interleave(program, { kind: 'random', seed }).events.some(
          (e) => e.kind === 'sync.spin',
        ),
      ).some(Boolean),
    ).toBe(true);
  });

  rule('sync.stuck', () => {
    const deadlock = manual(presetById('lock-order')!.program, 0, 1);
    expect(deadlock.state.result!.kind).toBe('stuck');
    expect(deadlock.result.events.at(-1)!.label).toBe(
      'No thread can move: T0 waits for B (held by T1); T1 waits for A (held by T0). Each waits for something only another waiting thread could provide: a deadlock.',
    );
    const forgotten = manual(presetById('forgotten-unlock')!.program, 0, 0, 0, 0);
    expect(forgotten.result.events.at(-1)!.label).toBe(
      'No thread can move: T1 waits for m (held by T0, which has finished and will never release it).',
    );
  });

  rule('sync.limit', () => {
    expect(LIMITS.maxTicks).toBe(300);
    // T0 holds m through 15 yields while two spinners burn their quanta: long, but the
    // programs are finite, so it still ends inside the limit.
    const program = programOf([
      [L(), ...Array.from({ length: 14 }, () => Y), U()],
      [L(), U()],
      [L(), U()],
    ]);
    const full = interleave(program, { kind: 'rr', quantum: 8 });
    expect(full.events.at(-1)!.state.result!.kind).toBe('done');
    expect(full.durationMs / 1000).toBeGreaterThan(200);
    // The same run with a lower limit is cut off at it.
    for (const schedule of [
      { kind: 'rr', quantum: 8 },
      { kind: 'random', seed: 3 },
    ] as const) {
      const capped = interleave(program, schedule, { maxTicks: 20 });
      const last = capped.events.at(-1)!;
      expect(last.kind).toBe('sync.limit');
      expect(last.tick).toBe(20);
      expect(last.label).toBe('The run stopped after 20 ticks without finishing.');
    }
  });

  rule('sync.explore', () => {
    // Spins are not interleavings: with the mutex only the two serial orders remain.
    const e = explore(counterProgram(0, true));
    expect(e.tooLarge).toBe(false);
    if (e.tooLarge) return;
    expect(e.total).toBe(2);
    expect(e.groups[0]!.example).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
  });

  rule('sync.lost', () => {
    // T0 loads, T1 stores twice, T0 stores: lost. T0 storing twice itself: not lost.
    const program = programOf([[LOAD, STORE, STORE], [STORE]]);
    const own = manual(program, 0, 0, 0);
    expect(
      own.result.events.filter((e) => e.kind === 'sync.store').map((e) => e.lost),
    ).toEqual([false, false]);
    const other = manual(program, 0, 1, 0);
    expect(
      other.result.events.filter((e) => e.kind === 'sync.store').map((e) => e.lost),
    ).toEqual([false, true]);
  });

  it('every rule has a test', () => {
    expect([...TESTED].sort()).toEqual(SYNC_RULES.map((r) => r.id).sort());
  });
});
