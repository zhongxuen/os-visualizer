import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  runMetrics,
  schedule,
  totalCpu,
  type Policy,
  type PolicyKind,
  type Workload,
} from '@/core/sched';
import type { SchedSegment } from '@/core/sched/events';

/**
 * Property tests for the scheduler: random valid workloads, every policy, 500 runs per
 * policy on fast-check's fixed global seed (tests/setup-core.ts).
 *
 * Workloads are kept small enough (at most 5 processes, CPU bursts at most 6, context
 * switches at most 2 ticks) that every run finishes inside the 300-tick limit.
 */

const RUNS = 500;

function workloadArb({ io = true, maxCs = 2 } = {}): fc.Arbitrary<Workload> {
  const burstsArb = io
    ? fc.oneof(
        fc.tuple(fc.integer({ min: 1, max: 6 })).map(([c]) => [c]),
        fc
          .tuple(
            fc.integer({ min: 1, max: 6 }),
            fc.integer({ min: 1, max: 6 }),
            fc.integer({ min: 1, max: 6 }),
          )
          .map(([a, b, c]) => [a, b, c]),
      )
    : fc.integer({ min: 1, max: 6 }).map((c) => [c]);
  return fc
    .record({
      processes: fc.array(
        fc.record({
          arrival: fc.integer({ min: 0, max: 20 }),
          bursts: burstsArb,
          priority: fc.integer({ min: 0, max: 9 }),
        }),
        { minLength: 1, maxLength: 5 },
      ),
      contextSwitch: fc.integer({ min: 0, max: maxCs }),
    })
    .map(({ processes, contextSwitch }) => ({
      processes: processes.map((p, i) => ({ pid: `P${i + 1}`, ...p })),
      contextSwitch,
    }));
}

const quantumArb = fc.integer({ min: 1, max: 10 });

const POLICY_ARBS: Record<PolicyKind, fc.Arbitrary<Policy>> = {
  fcfs: fc.constant({ kind: 'fcfs' }),
  sjf: fc.constant({ kind: 'sjf' }),
  srtf: fc.constant({ kind: 'srtf' }),
  priority: fc
    .record({
      preemptive: fc.boolean(),
      aging: fc.option(
        fc.record({
          every: fc.integer({ min: 1, max: 5 }),
          by: fc.integer({ min: 1, max: 3 }),
        }),
        { nil: undefined },
      ),
    })
    .map(({ preemptive, aging }) =>
      aging ? { kind: 'priority', preemptive, aging } : { kind: 'priority', preemptive },
    ),
  rr: quantumArb.map((quantum) => ({ kind: 'rr', quantum })),
  mlfq: fc
    .record({
      levels: fc.array(
        fc.record({ quantum: quantumArb, allotment: fc.integer({ min: 1, max: 12 }) }),
        { minLength: 2, maxLength: 4 },
      ),
      boostEvery: fc.option(fc.integer({ min: 1, max: 30 }), { nil: undefined }),
      rule4: fc.constantFrom('allotment' as const, 'original' as const),
    })
    .map(({ levels, boostEvery, rule4 }) =>
      boostEvery === undefined
        ? { kind: 'mlfq', levels, rule4 }
        : { kind: 'mlfq', levels, rule4, boostEvery },
    ),
};

const KINDS = Object.keys(POLICY_ARBS) as PolicyKind[];

function finalSegments(w: Workload, policy: Policy): SchedSegment[] {
  const run = schedule(w, policy);
  return run.events[run.events.length - 1]!.state.segments;
}

/** Strip MLFQ levels so layouts from different policies compare. */
function plain(segments: readonly SchedSegment[]) {
  return segments.map(({ pid, start, end }) => ({ pid, start, end }));
}

describe.each(KINDS)('%s: invariants', (kind) => {
  it('one process per tick, never before arrival or during I/O; every burst runs in full', () => {
    fc.assert(
      fc.property(workloadArb(), POLICY_ARBS[kind], (w, policy) => {
        const run = schedule(w, policy);
        const total = run.durationMs / 1000;
        const segments = run.events[run.events.length - 1]!.state.segments;

        // The segments tile [0, total) with no overlap: one thing per tick.
        let at = 0;
        for (const s of segments) {
          expect(s.start).toBe(at);
          expect(s.end).toBeGreaterThan(s.start);
          at = s.end;
        }
        expect(at).toBe(total);
        expect(run.events.some((e) => e.kind === 'sched.limit')).toBe(false);

        for (const p of w.processes) {
          // Expand to the ticks it ran, then walk its bursts.
          const ticks = segments
            .filter((s) => s.pid === p.pid)
            .flatMap((s) =>
              Array.from({ length: s.end - s.start }, (_, i) => s.start + i),
            );
          expect(ticks.length).toBe(totalCpu(p));
          let ready = p.arrival;
          let index = 0;
          for (let b = 0; b < p.bursts.length; b += 2) {
            const burst = ticks.slice(index, index + p.bursts[b]!);
            index += p.bursts[b]!;
            expect(burst[0]!).toBeGreaterThanOrEqual(ready);
            ready = burst[burst.length - 1]! + 1 + (p.bursts[b + 1] ?? 0);
          }
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('total ticks = CPU bursts + idle ticks + context-switch ticks', () => {
    fc.assert(
      fc.property(workloadArb(), POLICY_ARBS[kind], (w, policy) => {
        const m = runMetrics(w, schedule(w, policy));
        const cpu = w.processes.reduce((sum, p) => sum + totalCpu(p), 0);
        expect(m.complete).toBe(true);
        expect(m.busyTicks).toBe(cpu);
        expect(m.totalTicks).toBe(cpu + m.idleTicks + m.csTicks);
        if (w.contextSwitch === 0) expect(m.csTicks).toBe(0);
        else expect(m.csTicks).toBe(m.contextSwitches * w.contextSwitch);
      }),
      { numRuns: RUNS },
    );
  });

  it('waiting ≥ 0, turnaround ≥ Σ bursts, response ≤ waiting for single-burst processes', () => {
    fc.assert(
      fc.property(workloadArb(), POLICY_ARBS[kind], (w, policy) => {
        const m = runMetrics(w, schedule(w, policy));
        for (const p of m.processes) {
          const source = w.processes.find((q) => q.pid === p.pid)!;
          expect(p.waiting!).toBeGreaterThanOrEqual(0);
          expect(p.turnaround!).toBeGreaterThanOrEqual(p.cpu + p.io);
          if (source.bursts.length === 1)
            expect(p.response!).toBeLessThanOrEqual(p.waiting!);
        }
      }),
      { numRuns: RUNS },
    );
  });
});

describe('policy relationships (context switch 0, no I/O)', () => {
  const simple = workloadArb({ io: false, maxCs: 0 });

  it('FCFS, SJF and non-preemptive priority never preempt', () => {
    const policies: Policy[] = [
      { kind: 'fcfs' },
      { kind: 'sjf' },
      { kind: 'priority', preemptive: false },
    ];
    fc.assert(
      fc.property(simple, (w) => {
        for (const policy of policies) {
          const run = schedule(w, policy);
          expect(run.events.filter((e) => e.kind === 'sched.preempt')).toEqual([]);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('SRTF has an average waiting time ≤ every other policy (it is optimal)', () => {
    fc.assert(
      fc.property(
        simple,
        fc.array(fc.oneof(...KINDS.map((k) => POLICY_ARBS[k])), {
          minLength: 1,
          maxLength: 4,
        }),
        (w, others) => {
          const srtf = runMetrics(w, schedule(w, { kind: 'srtf' })).avgWaiting;
          for (const policy of others) {
            const other = runMetrics(w, schedule(w, policy)).avgWaiting;
            expect(srtf).toBeLessThanOrEqual(other + 1e-9);
          }
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe('equivalences', () => {
  it('RR with a quantum ≥ the longest burst produces the same segments as FCFS', () => {
    fc.assert(
      fc.property(workloadArb(), fc.integer({ min: 0, max: 4 }), (w, extra) => {
        const longest = Math.max(...w.processes.flatMap((p) => p.bursts));
        expect(finalSegments(w, { kind: 'rr', quantum: longest + extra })).toEqual(
          finalSegments(w, { kind: 'fcfs' }),
        );
      }),
      { numRuns: RUNS },
    );
  });

  it('MLFQ with one level behaves as RR with that quantum', () => {
    fc.assert(
      fc.property(
        workloadArb(),
        quantumArb,
        fc.integer({ min: 1, max: 12 }),
        fc.constantFrom('allotment' as const, 'original' as const),
        (w, quantum, allotment, rule4) => {
          // One level is below the editor's minimum of 2; the kernel accepts it.
          const one: Policy = { kind: 'mlfq', levels: [{ quantum, allotment }], rule4 };
          expect(plain(finalSegments(w, one))).toEqual(
            plain(finalSegments(w, { kind: 'rr', quantum })),
          );
        },
      ),
      { numRuns: RUNS },
    );
  });
});
