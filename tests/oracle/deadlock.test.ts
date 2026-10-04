import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  addVec,
  applyRecovery,
  coffman,
  detect,
  graphFromMatrices,
  isDeadlocked,
  leq,
  needOf,
  ragCycle,
  requestResources,
  runGraph,
  runRequest,
  runSafety,
  safety,
  validateBankers,
  validateGraph,
  type BankersState,
  type RagMatrices,
} from '@/core/deadlock';

/**
 * Oracle and property tests for deadlock, on fast-check's fixed global seed
 * (tests/setup-core.ts). The oracle tries every ordering of the threads (n ≤ 6, so at
 * most 720) and so plays the role a reference implementation would.
 */

const RUNS = 500;

function permutations(items: readonly number[]): number[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((first, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
      first,
      ...rest,
    ]),
  );
}

/**
 * The threads that finish when `order` is followed until one cannot go on: each takes
 * its row from Work, then releases its Allocation.
 */
function finishedPrefix(
  rows: readonly (readonly number[])[],
  allocation: readonly (readonly number[])[],
  available: readonly number[],
  order: readonly number[],
): number[] {
  let work = [...available];
  const done: number[] = [];
  for (const t of order) {
    if (!leq(rows[t]!, work)) break;
    work = addVec(work, allocation[t]!);
    done.push(t);
  }
  return done;
}

/** Brute force: safe ⇔ some ordering of every thread finishes. */
function bruteSafe(state: BankersState): boolean {
  const need = needOf(state);
  const all = state.max.map((_, t) => t);
  return permutations(all).some(
    (order) =>
      finishedPrefix(need, state.allocation, state.available, order).length ===
      all.length,
  );
}

/**
 * Brute force: the threads holding something that finish in no ordering at all. (A thread
 * holding nothing is never deadlocked, OSC10 §8.7.2.)
 */
function bruteDeadlocked(m: RagMatrices): number[] {
  const holders = m.allocation.flatMap((row, t) => (row.some((n) => n > 0) ? [t] : []));
  const canFinish = new Set<number>();
  for (const order of permutations(holders)) {
    for (const t of finishedPrefix(m.request, m.allocation, m.available, order)) {
      canFinish.add(t);
    }
  }
  return holders.filter((t) => !canFinish.has(t));
}

/** Random Banker's states: n ≤ 6 threads, m ≤ 4 resource types. */
const bankersState = fc
  .record({ n: fc.integer({ min: 1, max: 6 }), m: fc.integer({ min: 1, max: 4 }) })
  .chain(({ n, m }) =>
    fc
      .record({
        max: fc.array(
          fc.array(fc.integer({ min: 0, max: 6 }), { minLength: m, maxLength: m }),
          {
            minLength: n,
            maxLength: n,
          },
        ),
        fraction: fc.array(
          fc.array(fc.integer({ min: 0, max: 6 }), { minLength: m, maxLength: m }),
          { minLength: n, maxLength: n },
        ),
        available: fc.array(fc.integer({ min: 0, max: 5 }), {
          minLength: m,
          maxLength: m,
        }),
      })
      .map(({ max, fraction, available }) => ({
        max,
        // Allocation ≤ Max by construction.
        allocation: max.map((row, t) =>
          row.map((cap, r) => Math.min(cap, fraction[t]![r]!)),
        ),
        available,
      })),
  );

/** Random resource-allocation states, as matrices: n ≤ 6 threads, m ≤ 4 types. */
function ragState(single: boolean) {
  return fc
    .record({ n: fc.integer({ min: 1, max: 6 }), m: fc.integer({ min: 1, max: 4 }) })
    .chain(({ n, m }) =>
      fc
        .record({
          total: fc.array(fc.integer({ min: 1, max: single ? 1 : 4 }), {
            minLength: m,
            maxLength: m,
          }),
          owner: fc.array(
            fc.array(fc.integer({ min: -1, max: n - 1 }), { minLength: 4, maxLength: 4 }),
            { minLength: m, maxLength: m },
          ),
          wants: fc.array(
            fc.array(fc.integer({ min: 0, max: single ? 1 : 3 }), {
              minLength: m,
              maxLength: m,
            }),
            { minLength: n, maxLength: n },
          ),
        })
        .map(({ total, owner, wants }) => {
          // Hand each instance to an owner (or nobody), then cap requests so that
          // held + requested never exceeds the total.
          const allocation = Array.from({ length: n }, () => total.map(() => 0));
          total.forEach((count, r) => {
            for (let i = 0; i < count; i += 1) {
              const t = owner[r]![i]!;
              if (t >= 0) allocation[t]![r]! += 1;
            }
          });
          const request = wants.map((row, t) =>
            row.map((w, r) => Math.min(w, total[r]! - allocation[t]![r]!)),
          );
          const available = total.map(
            (count, r) => count - allocation.reduce((s, row) => s + row[r]!, 0),
          );
          return { total, allocation, request, available } satisfies RagMatrices;
        }),
    );
}

describe('Banker’s oracle', () => {
  it('safe ⇔ some ordering of the threads finishes (brute force)', () => {
    fc.assert(
      fc.property(bankersState, (state) => {
        expect(validateBankers(state).ok).toBe(true);
        expect(safety(state).safe).toBe(bruteSafe(state));
      }),
      { numRuns: RUNS },
    );
  });

  it('every sequence Banker’s reports is a valid finishing order', () => {
    fc.assert(
      fc.property(bankersState, (state) => {
        const { safe, order } = safety(state);
        const done = finishedPrefix(
          needOf(state),
          state.allocation,
          state.available,
          order,
        );
        expect(done).toEqual(order);
        if (safe) expect([...order].sort()).toEqual(state.max.map((_, t) => t));
        const last = runSafety(state).events.at(-1)!.state.result!;
        expect(last).toEqual(
          safe ? { kind: 'safe', order } : { kind: 'unsafe', stuck: safety(state).stuck },
        );
      }),
      { numRuns: RUNS },
    );
  });

  it('the request algorithm grants exactly the requests that fit and leave a safe state', () => {
    const withRequest = bankersState.chain((state) =>
      fc.record({
        state: fc.constant(state),
        t: fc.integer({ min: 0, max: state.max.length - 1 }),
        request: fc.array(fc.integer({ min: 0, max: 4 }), {
          minLength: state.available.length,
          maxLength: state.available.length,
        }),
      }),
    );
    fc.assert(
      fc.property(withRequest, ({ state, t, request }) => {
        const { outcome } = requestResources(state, { t, request });
        const fitsNeed = leq(request, needOf(state)[t]!);
        const fitsAvailable = leq(request, state.available);
        if (!fitsNeed) expect(outcome).toBe('error');
        else if (!fitsAvailable) expect(outcome).toBe('wait');
        else {
          const after: BankersState = {
            max: state.max,
            allocation: state.allocation.map((row, i) =>
              i === t ? addVec(row, request) : row,
            ),
            available: state.available.map((free, r) => free - request[r]!),
          };
          expect(outcome).toBe(bruteSafe(after) ? 'granted' : 'refused');
        }
        const run = runRequest(state, { t, request });
        expect(run.events.at(-1)!.state.result!.kind).toBe(outcome);
      }),
      { numRuns: RUNS },
    );
  });
});

describe('detection oracle', () => {
  it('the deadlocked set = the threads that finish in no ordering (brute force)', () => {
    fc.assert(
      fc.property(ragState(false), (m) => {
        expect(
          validateGraph(graphFromMatrices(m.total, m.allocation, m.request)).ok,
        ).toBe(true);
        const result = detect(m);
        expect(result.set).toEqual(bruteDeadlocked(m));
        expect(result.deadlocked).toBe(result.set.length > 0);
        const done = finishedPrefix(m.request, m.allocation, m.available, result.order);
        expect(done).toEqual(result.order);
      }),
      { numRuns: RUNS },
    );
  });

  it('on single-instance graphs, a wait-for cycle ⇔ the detection algorithm finds deadlock', () => {
    fc.assert(
      fc.property(ragState(true), (m) => {
        const graph = graphFromMatrices(m.total, m.allocation, m.request);
        const deadlocked = detect(m).deadlocked;
        expect(isDeadlocked(m, 'cycle')).toBe(deadlocked);
        expect(ragCycle(m) !== null).toBe(deadlocked);
        const last = runGraph(graph, 'cycle').events.at(-1)!.state.result!;
        expect(last.kind).toBe(deadlocked ? 'cycle' : 'acyclic');
      }),
      { numRuns: RUNS },
    );
  });

  it('a cycle is necessary for deadlock, on any graph', () => {
    fc.assert(
      fc.property(ragState(false), (m) => {
        if (detect(m).deadlocked) {
          expect(ragCycle(m)).not.toBeNull();
          const conditions = coffman(m);
          expect(conditions.find((c) => c.id === 'hold-and-wait')!.status).toBe('holds');
          expect(conditions.find((c) => c.id === 'circular-wait')!.status).toBe('holds');
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('after terminating every deadlocked thread, detection reports no deadlock', () => {
    fc.assert(
      fc.property(ragState(false), (m) => {
        const { set } = detect(m);
        let current = m;
        const terminated: number[] = [];
        for (const t of set) {
          const next = applyRecovery(current, terminated, { kind: 'terminate', t });
          if (!next.ok) throw new Error(next.message);
          current = next.value;
          terminated.push(t);
        }
        expect(detect(current).deadlocked).toBe(false);
        const graph = graphFromMatrices(m.total, m.allocation, m.request);
        const run = runGraph(
          graph,
          'detect',
          set.map((t) => ({ kind: 'terminate' as const, t })),
        );
        expect(run.events.at(-1)!.state.result!.kind).toBe('not-deadlocked');
      }),
      { numRuns: RUNS },
    );
  });
});
