import { describe, expect, it } from 'vitest';

import {
  counterProgram,
  explore,
  interleave,
  presetById,
  prodconsProgram,
  type Exploration,
} from '@/core/sync';

import { manual, run } from './helpers';

function explored(e: Exploration) {
  if (e.tooLarge) throw new Error('exploration too large');
  return e;
}

/**
 * OSTEP v1.10 §26.4, Figure 26.7: counter starts at 50; thread 1 loads and adds, is
 * interrupted, thread 2 does the whole increment (counter = 51), then thread 1 stores
 * its stale 51. Book threads 1 and 2 are T0 and T1 here.
 */
describe('OSTEP §26.4: the counter race', () => {
  it('the Figure 26.7 interleaving loses an update: 50 → 51', () => {
    const { result, state } = manual(counterProgram(50), 0, 0, 1, 1, 1, 0);
    expect(state.vars.counter).toBe(51);
    expect(state.result).toEqual({
      kind: 'done',
      correct: false,
      values: { counter: 51 },
    });
    const stores = result.events.filter((e) => e.kind === 'sync.store');
    expect(stores.map((e) => [e.thread, e.lost])).toEqual([
      [1, false],
      [0, true],
    ]);
    expect(result.events.at(-1)!.label).toMatch(/1 update was lost/);
  });

  it('run one after the other, the result is right: 50 → 52', () => {
    expect(manual(counterProgram(50), 0, 0, 0, 1, 1, 1).state.vars.counter).toBe(52);
    expect(manual(counterProgram(50), 1, 1, 1, 0, 0, 0).state.vars.counter).toBe(52);
  });

  it('of the 20 interleavings of two three-op increments, only the 2 serial ones are right', () => {
    const e = explored(explore(counterProgram(0)));
    expect(e.total).toBe(20);
    expect(e.groups.map((g) => [g.label, g.count, g.correct])).toEqual([
      ['counter = 2', 2, true],
      ['counter = 1', 18, false],
    ]);
  });

  it('with the mutex (OSTEP §28.7), every interleaving is right', () => {
    const e = explored(explore(counterProgram(0, true)));
    expect(e.groups.every((g) => g.correct === true)).toBe(true);
    for (let seed = 0; seed < 50; seed += 1) {
      expect(run(counterProgram(0, true), { kind: 'random', seed }).state.result).toEqual(
        {
          kind: 'done',
          correct: true,
          values: { counter: 2 },
        },
      );
    }
  });
});

/** OSTEP v1.10 §31.4: producer/consumer on a bounded buffer. */
describe('OSTEP §31.4: producer/consumer', () => {
  for (const size of [1, 2]) {
    describe(`buffer of ${size}`, () => {
      const program = prodconsProgram(size);

      it('never under- or overflows, and ends with count = 0, over every interleaving', () => {
        const e = explored(explore(program));
        expect(e.boundsHeld).toBe(true);
        expect(e.groups).toHaveLength(1);
        expect(e.groups[0]).toMatchObject({
          kind: 'done',
          correct: true,
          values: { count: 0 },
        });
      });

      it('never under- or overflows on any tick of 200 seeded random and every round-robin run', () => {
        const schedules = [
          ...Array.from({ length: 200 }, (_, seed) => ({
            kind: 'random' as const,
            seed,
          })),
          ...Array.from({ length: 8 }, (_, i) => ({
            kind: 'rr' as const,
            quantum: i + 1,
          })),
        ];
        for (const schedule of schedules) {
          const result = interleave(program, schedule);
          for (const event of result.events) {
            expect(event.state.vars.count).toBeGreaterThanOrEqual(0);
            expect(event.state.vars.count).toBeLessThanOrEqual(size);
          }
          expect(result.events.at(-1)!.state.result).toMatchObject({
            kind: 'done',
            correct: true,
          });
        }
      });
    });
  }

  it('with the mutex outside the waits, it can deadlock', () => {
    const program = prodconsProgram(1, true);
    const e = explored(explore(program));
    expect(e.groups.some((g) => g.kind === 'stuck')).toBe(true);
    const { state, result } = manual(program, 1, 1);
    expect(state.result!.kind).toBe('stuck');
    expect(state.status).toEqual(['spinning', 'blocked']);
    expect(result.events.at(-1)!.label).toMatch(/a deadlock/);
  });

  it('the preset is the same program', () => {
    expect(presetById('prodcons-1')!.program).toEqual(prodconsProgram(1));
    expect(presetById('prodcons-broken')!.program).toEqual(prodconsProgram(1, true));
  });
});
