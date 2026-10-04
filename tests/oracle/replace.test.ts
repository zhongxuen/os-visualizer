import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  countFaults,
  faultsByFrames,
  POLICIES,
  refResults,
  replace,
  type Policy,
} from '@/core/replace';

/**
 * Oracle and property tests for page replacement, on fast-check's fixed global seed
 * (tests/setup-core.ts).
 *
 * The oracle: for short strings, an exhaustive search over every possible eviction
 * choice, memoised on (index, resident set), finds the true minimum number of faults.
 * OPT must equal it.
 */

const RUNS = 500;

/** The minimum faults any eviction policy could achieve, by exhaustive search. */
function minFaults(refString: readonly number[], frames: number): number {
  const memo = new Map<string, number>();
  const go = (index: number, resident: readonly number[]): number => {
    if (index === refString.length) return 0;
    const key = `${index}|${[...resident].sort((a, b) => a - b).join(',')}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const page = refString[index]!;
    let best: number;
    if (resident.includes(page)) best = go(index + 1, resident);
    else if (resident.length < frames) best = 1 + go(index + 1, [...resident, page]);
    else {
      best = Infinity;
      for (const out of resident) {
        best = Math.min(
          best,
          1 + go(index + 1, [...resident.filter((p) => p !== out), page]),
        );
      }
    }
    memo.set(key, best);
    return best;
  };
  return go(0, []);
}

const smallCase = fc.record({
  refString: fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 1, maxLength: 12 }),
  frames: fc.integer({ min: 1, max: 4 }),
});

const anyCase = fc.record({
  refString: fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 1, maxLength: 40 }),
  frames: fc.integer({ min: 1, max: 8 }),
});

/** Strings with locality, where policies differ more. */
const localCase = fc.record({
  refString: fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 40 }),
  frames: fc.integer({ min: 1, max: 6 }),
});

const cases = fc.oneof(anyCase, localCase);

describe('OPT oracle', () => {
  it('OPT equals the exhaustive minimum on every short string', () => {
    fc.assert(
      fc.property(smallCase, ({ refString, frames }) => {
        expect(countFaults(refString, frames, 'opt').faults).toBe(
          minFaults(refString, frames),
        );
      }),
      { numRuns: RUNS },
    );
  });

  it('the oracle agrees with the textbook OPT counts', () => {
    expect(
      minFaults([7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1], 3),
    ).toBe(9);
    expect(minFaults([0, 1, 2, 0, 1, 3, 0, 3, 1, 2, 1], 3)).toBe(5);
  });
});

describe('page replacement properties', () => {
  it('OPT faults ≤ FIFO, LRU and Clock faults', () => {
    fc.assert(
      fc.property(cases, ({ refString, frames }) => {
        const opt = countFaults(refString, frames, 'opt').faults;
        for (const policy of ['fifo', 'lru', 'clock'] as const) {
          expect(opt).toBeLessThanOrEqual(countFaults(refString, frames, policy).faults);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('stack property: LRU and OPT faults never increase from 1 to 8 frames', () => {
    fc.assert(
      fc.property(cases, ({ refString }) => {
        for (const policy of ['lru', 'opt'] as const) {
          const curve = faultsByFrames(refString, policy);
          for (let i = 1; i < curve.length; i += 1) {
            expect(curve[i]).toBeLessThanOrEqual(curve[i - 1]!);
          }
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('distinct ≤ faults ≤ length, hits + faults = length, cold = distinct', () => {
    fc.assert(
      fc.property(cases, ({ refString, frames }) => {
        const distinct = new Set(refString).size;
        for (const policy of POLICIES) {
          const c = countFaults(refString, frames, policy);
          expect(c.faults).toBeGreaterThanOrEqual(distinct);
          expect(c.faults).toBeLessThanOrEqual(refString.length);
          expect(c.hits + c.faults).toBe(refString.length);
          expect(c.cold).toBe(distinct);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('with frames ≥ distinct pages, every policy faults once per distinct page', () => {
    fc.assert(
      fc.property(cases, ({ refString, frames }) => {
        const distinct = new Set(refString).size;
        fc.pre(frames >= distinct);
        for (const policy of POLICIES) {
          expect(countFaults(refString, frames, policy).faults).toBe(distinct);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('with 1 frame, every policy gives the same result', () => {
    fc.assert(
      fc.property(cases, ({ refString }) => {
        const results = POLICIES.map((policy) =>
          refResults(replace(refString, 1, policy)).map(({ hit, frames }) => ({
            hit,
            frames,
          })),
        );
        for (const r of results) expect(r).toEqual(results[0]);
      }),
      { numRuns: RUNS },
    );
  });

  it('Clock never evicts a page whose use bit is 1', () => {
    fc.assert(
      fc.property(cases, ({ refString, frames }) => {
        for (const e of replace(refString, frames, 'clock').events) {
          if (e.kind === 'repl.victim') expect(e.state.useBits![e.frame!]).toBe(0);
          if (e.kind === 'repl.scan') expect(e.state.useBits![e.frame!]).toBe(0);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('the event run agrees with the fast count, and frames hold no duplicates', () => {
    fc.assert(
      fc.property(
        cases,
        fc.constantFrom<Policy>(...POLICIES),
        ({ refString, frames }, policy) => {
          const run = replace(refString, frames, policy);
          const last = run.events.at(-1)!.state;
          const { hits, faults, cold } = countFaults(refString, frames, policy);
          expect({ hits: last.hits, faults: last.faults, cold: last.cold }).toEqual({
            hits,
            faults,
            cold,
          });
          expect(run.phases).toHaveLength(refString.length);
          const results = refResults(run);
          expect(results.map((r) => r.page)).toEqual(refString);
          for (const e of run.events) {
            const pages = e.state.frames.filter((p) => p !== null);
            expect(new Set(pages).size).toBe(pages.length);
            expect(e.state.frames).toHaveLength(frames);
          }
          results.forEach((r) => expect(r.frames[r.frame]).toBe(r.page));
        },
      ),
      { numRuns: RUNS },
    );
  });
});
