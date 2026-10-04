import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  counterProgram,
  effectivePicks,
  explore,
  interleave,
  SYNC_PRESETS,
  type Exploration,
  type Program,
  type SyncSnapshot,
} from '@/core/sync';

import { lockedProgram, schedule, smallProgram } from '../fixtures/sync/helpers';

/**
 * Brute force for the synchronisation core.
 *
 * `naive` below is a second, independent interpreter of the same micro-ops (it shares no
 * code with `src/core/sync`), and it lists every interleaving one at a time with no
 * memoisation. `explore()` must find the same outcomes with the same counts.
 */

interface NaiveState {
  pcs: number[];
  regs: Record<string, number>[];
  vars: Record<string, number>;
  owner: Record<string, number | null>;
  sem: Record<string, { value: number; queue: number[] }>;
  asleep: boolean[];
}

function naiveStart(p: Program): NaiveState {
  return {
    pcs: p.threads.map(() => 0),
    regs: p.threads.map(() => ({})),
    vars: Object.fromEntries(p.vars.map((v) => [v.name, v.init])),
    owner: Object.fromEntries(p.locks.map((m) => [m, null])),
    sem: Object.fromEntries(p.sems.map((s) => [s.name, { value: s.init, queue: [] }])),
    asleep: p.threads.map(() => false),
  };
}

/** Can thread t do something that changes the state? */
function canMove(p: Program, s: NaiveState, t: number): boolean {
  const op = p.threads[t]!.ops[s.pcs[t]!];
  if (!op || s.asleep[t]) return false;
  return !(op.op === 'lock' && s.owner[op.m] !== null);
}

/** One op; `'error'` for an unlock by a non-owner. */
function naiveStep(p: Program, s0: NaiveState, t: number): NaiveState | 'error' {
  const s: NaiveState = structuredClone(s0);
  const op = p.threads[t]!.ops[s.pcs[t]!]!;
  const regs = s.regs[t]!;
  let next = s.pcs[t]! + 1;
  if (op.op === 'load') regs[op.reg] = s.vars[op.var]!;
  else if (op.op === 'add') regs[op.reg] = (regs[op.reg] ?? 0) + op.k;
  else if (op.op === 'store') s.vars[op.var] = regs[op.reg] ?? 0;
  else if (op.op === 'lock') s.owner[op.m] = t;
  else if (op.op === 'unlock') {
    if (s.owner[op.m] !== t) return 'error';
    s.owner[op.m] = null;
  } else if (op.op === 'wait') {
    const sem = s.sem[op.s]!;
    if (sem.value > 0) sem.value -= 1;
    else {
      sem.queue.push(t);
      s.asleep[t] = true;
      next = s.pcs[t]!;
    }
  } else if (op.op === 'signal') {
    const sem = s.sem[op.s]!;
    const woken = sem.queue.shift();
    if (woken === undefined) sem.value += 1;
    else {
      s.asleep[woken] = false;
      s.pcs[woken] = s.pcs[woken]! + 1;
    }
  }
  s.pcs[t] = next;
  return s;
}

function valuesKey(vars: Record<string, number>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
}

/** Outcome → number of interleavings, by listing every one. */
function naive(p: Program): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
  const walk = (s: NaiveState) => {
    const finished = p.threads.every((th, t) => s.pcs[t]! >= th.ops.length);
    if (finished) return add(`done:${valuesKey(s.vars)}`);
    const movers = p.threads.flatMap((_, t) => (canMove(p, s, t) ? [t] : []));
    if (movers.length === 0) return add(`stuck:${valuesKey(s.vars)}`);
    for (const t of movers) {
      const next = naiveStep(p, s, t);
      if (next === 'error') add(`error:${valuesKey(s.vars)}`);
      else walk(next);
    }
  };
  walk(naiveStart(p));
  return counts;
}

/** explore()'s groups folded to the same keys as `naive`. */
function folded(e: Exploration): Map<string, number> {
  if (e.tooLarge) throw new Error('too large');
  const counts = new Map<string, number>();
  for (const g of e.groups) {
    const key = `${g.kind}:${valuesKey(g.values)}`;
    counts.set(key, (counts.get(key) ?? 0) + g.count);
  }
  return counts;
}

function sorted(map: Map<string, number>) {
  return [...map].sort(([a], [b]) => (a < b ? -1 : 1));
}

describe('explore() agrees with brute force', () => {
  for (const preset of SYNC_PRESETS) {
    it(`${preset.id}: same outcomes, same counts`, () => {
      expect(sorted(folded(explore(preset.program)))).toEqual(
        sorted(naive(preset.program)),
      );
    });
  }

  it('on generated programs of up to 2 threads × 6 ops', () => {
    fc.assert(
      fc.property(smallProgram, (p) => {
        expect(sorted(folded(explore(p)))).toEqual(sorted(naive(p)));
      }),
      { numRuns: 300 },
    );
  });

  it('each group’s example interleaving really ends that way', () => {
    for (const preset of SYNC_PRESETS) {
      const e = explore(preset.program);
      if (e.tooLarge) throw new Error('too large');
      for (const g of e.groups) {
        const last = interleave(preset.program, {
          kind: 'manual',
          picks: g.example,
        }).events.at(-1)!;
        expect(last.state.result, `${preset.id}: ${g.label}`).toMatchObject({
          kind: g.kind,
          values: g.values,
        });
      }
    }
  });

  it('the unlocked counter can go wrong; with the mutex it never does', () => {
    const race = explore(counterProgram(0));
    const fixed = explore(counterProgram(0, true));
    if (race.tooLarge || fixed.tooLarge) throw new Error('too large');
    expect(race.groups.some((g) => g.correct === false)).toBe(true);
    expect(fixed.groups.every((g) => g.correct === true)).toBe(true);
  });

  it('refuses rather than runs past the state cap', () => {
    expect(explore(SYNC_PRESETS.find((p) => p.id === 'prodcons-2')!.program, 10)).toEqual(
      {
        tooLarge: true,
        states: 10,
      },
    );
  });
});

/** Snapshots before and after every event, starting from the first. */
function pairs(states: SyncSnapshot[]) {
  return states.slice(1).map((after, i) => ({ before: states[i]!, after }));
}

function countOps(
  p: Program,
  pcs: number[],
  kind: 'wait' | 'signal' | 'lock' | 'unlock',
  name: string,
) {
  return p.threads.reduce(
    (sum, th, t) =>
      sum +
      th.ops
        .slice(0, pcs[t])
        .filter(
          (op) => op.op === kind && ('s' in op ? op.s : 'm' in op ? op.m : '') === name,
        ).length,
    0,
  );
}

describe('properties of every run', () => {
  it('at most one thread is inside a mutex-guarded critical section on any tick', () => {
    fc.assert(
      fc.property(lockedProgram, schedule, (p, s) => {
        for (const event of interleave(p, s).events) {
          const inside = p.threads.filter((th, t) => {
            const done = th.ops.slice(0, event.state.pcs[t]);
            const locks = done.filter((op) => op.op === 'lock').length;
            const unlocks = done.filter((op) => op.op === 'unlock').length;
            return locks > unlocks;
          });
          expect(inside.length).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('a semaphore’s value is its initial value + signals − completed waits, never negative', () => {
    fc.assert(
      fc.property(fc.oneof(smallProgram, lockedProgram), schedule, (p, s) => {
        for (const event of interleave(p, s).events) {
          for (const decl of p.sems) {
            const value = event.state.sems[decl.name]!.value;
            const signals = countOps(p, event.state.pcs, 'signal', decl.name);
            const waits = countOps(p, event.state.pcs, 'wait', decl.name);
            expect(value).toBe(decl.init + signals - waits);
            expect(value).toBeGreaterThanOrEqual(0);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it('a blocked or finished thread never runs an op', () => {
    fc.assert(
      fc.property(fc.oneof(smallProgram, lockedProgram), schedule, (p, s) => {
        const events = interleave(p, s).events;
        events.forEach((event, i) => {
          if (i === 0 || event.thread === undefined || event.kind === 'sync.done') return;
          if (event.kind === 'sync.invalid') return;
          const before = events[i - 1]!.state;
          expect(['ready', 'spinning']).toContain(before.status[event.thread]);
        });
      }),
      { numRuns: 300 },
    );
  });

  it('a spin changes nothing but the tick', () => {
    fc.assert(
      fc.property(lockedProgram, schedule, (p, s) => {
        const events = interleave(p, s).events;
        for (const { before, after } of pairs(events.map((e) => e.state))) {
          const event = events.find((e) => e.state === after)!;
          if (event.kind !== 'sync.spin') continue;
          const keep = (x: SyncSnapshot) => ({
            pcs: x.pcs,
            regs: x.regs,
            vars: x.vars,
            locks: x.locks,
            sems: x.sems,
            status: x.status,
          });
          expect(keep(after)).toEqual(keep(before));
          expect(after.tick).toBe(before.tick + 1);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('replaying a run’s effective picks by hand reaches the same state', () => {
    fc.assert(
      fc.property(fc.oneof(smallProgram, lockedProgram), schedule, (p, s) => {
        const original = interleave(p, s);
        const replay = interleave(p, { kind: 'manual', picks: effectivePicks(original) });
        const a = original.events.at(-1)!.state;
        const b = replay.events.at(-1)!.state;
        const machine = (x: SyncSnapshot) => ({
          pcs: x.pcs,
          regs: x.regs,
          vars: x.vars,
          locks: x.locks,
          sems: x.sems,
        });
        expect(machine(b)).toEqual(machine(a));
        if (a.result && a.result.kind !== 'limit' && a.result.kind !== 'error') {
          expect(b.result).toEqual(a.result);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(fc.oneof(smallProgram, lockedProgram), schedule, (p, s) => {
        expect(interleave(p, s)).toStrictEqual(interleave(p, s));
      }),
      { numRuns: 100 },
    );
  });
});
