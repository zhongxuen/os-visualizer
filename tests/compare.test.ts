import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  bestIndexes,
  columnNames,
  compare,
  COMPARE_PRESETS,
  COMPARE_SHARE_STATE,
  runMetrics,
  schedule,
  whyLine,
  whyParts,
  type Policy,
  type Workload,
} from '@/core/sched';
import { timelineFrom } from '@/core/sim/playback';
import { decodeShareState, encodeShareState } from '@/core/state/shareState';

const workloadArb: fc.Arbitrary<Workload> = fc
  .record({
    processes: fc.array(
      fc.record({
        arrival: fc.integer({ min: 0, max: 10 }),
        burst: fc.integer({ min: 1, max: 8 }),
        priority: fc.integer({ min: 0, max: 9 }),
      }),
      { minLength: 1, maxLength: 5 },
    ),
    contextSwitch: fc.integer({ min: 0, max: 1 }),
  })
  .map(({ processes, contextSwitch }) => ({
    processes: processes.map((p, i) => ({
      pid: `P${i + 1}`,
      arrival: p.arrival,
      bursts: [p.burst],
      priority: p.priority,
    })),
    contextSwitch,
  }));

const policyArb: fc.Arbitrary<Policy> = fc.oneof(
  fc.constant<Policy>({ kind: 'fcfs' }),
  fc.constant<Policy>({ kind: 'sjf' }),
  fc.constant<Policy>({ kind: 'srtf' }),
  fc.boolean().map<Policy>((preemptive) => ({ kind: 'priority', preemptive })),
  fc.integer({ min: 1, max: 6 }).map<Policy>((quantum) => ({ kind: 'rr', quantum })),
);

describe('compare', () => {
  it.each(COMPARE_PRESETS.map((p) => [p.id, p] as const))(
    '%s: each run equals schedule() on its own',
    (_id, preset) => {
      const result = compare(preset.workload, preset.policies);
      expect(result.runs).toStrictEqual(
        preset.policies.map((policy) => schedule(preset.workload, policy)),
      );
      result.metrics.forEach((m, i) => {
        expect(m).toStrictEqual(runMetrics(preset.workload, result.runs[i]!));
      });
    },
  );

  it('runs on one timeline of length max(duration), one phase per tick', () => {
    const preset = COMPARE_PRESETS.find((p) => p.id === 'rr-sweep')!;
    const result = compare(preset.workload, preset.policies);
    const longest = Math.max(...result.runs.map((r) => r.durationMs / 1000));
    expect(result.durationTicks).toBe(longest);
    expect(result.timeline.durationMs).toBe(longest * 1000);
    expect(result.timeline.phases).toHaveLength(longest);
    expect(timelineFrom(result.timeline).phaseStarts).toEqual(
      Array.from({ length: longest }, (_, t) => t * 1000),
    );
  });

  it('the RR quantum sweep has fewer context switches as the quantum grows', () => {
    const preset = COMPARE_PRESETS.find((p) => p.id === 'rr-sweep')!;
    const row = compare(preset.workload, preset.policies).table.find(
      (r) => r.id === 'contextSwitches',
    )!;
    for (let i = 1; i < row.values.length; i += 1) {
      expect(row.values[i]!).toBeLessThan(row.values[i - 1]!);
    }
  });

  it('takes 2 to 4 policies and numbers repeated names', () => {
    const w = COMPARE_PRESETS[0]!.workload;
    expect(() => compare(w, [{ kind: 'fcfs' }])).toThrow(RangeError);
    expect(() => compare(w, Array(5).fill({ kind: 'fcfs' }))).toThrow(RangeError);
    expect(
      columnNames([
        { kind: 'rr', quantum: 4 },
        { kind: 'rr', quantum: 1 },
        { kind: 'rr', quantum: 4 },
      ]),
    ).toEqual(['RR q=4', 'RR q=1', 'RR q=4 (2)']);
  });

  it('the "Why?" line names the policy that is actually best on each row', () => {
    fc.assert(
      fc.property(
        workloadArb,
        fc.array(policyArb, { minLength: 2, maxLength: 4 }),
        (w, policies) => {
          const result = compare(w, policies);
          const line = whyLine(result.table, result.names);
          for (const part of whyParts(result.table, result.names)) {
            const row = result.table.find((r) => r.id === part.row)!;
            const values = row.values;
            const best =
              row.better === 'lower' ? Math.min(...values) : Math.max(...values);
            for (const i of part.best) expect(values[i]!).toBeCloseTo(best, 9);
            for (let i = 0; i < values.length; i += 1) {
              if (!part.best.includes(i))
                expect(Math.abs(values[i]! - best)).toBeGreaterThan(1e-7);
            }
            expect(line.toLowerCase()).toContain(part.text.toLowerCase());
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('bestIndexes marks ties', () => {
    expect(bestIndexes({ values: [3, 1, 1], better: 'lower' })).toEqual([1, 2]);
    expect(bestIndexes({ values: [0.5, 0.75], better: 'higher' })).toEqual([1]);
  });

  it('the compare share state round-trips every preset', () => {
    for (const preset of COMPARE_PRESETS) {
      const state = {
        ...COMPARE_SHARE_STATE.defaults,
        step: 3,
        input: { workload: preset.workload, policies: preset.policies },
      };
      const encoded = encodeShareState(COMPARE_SHARE_STATE, state);
      expect(decodeShareState(COMPARE_SHARE_STATE, encoded)).toStrictEqual(state);
    }
  });
});
