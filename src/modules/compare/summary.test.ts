import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  compare,
  COMPARE_PRESETS,
  whyLine,
  whyParts,
  type Policy,
  type Workload,
} from '@/core/sched';
import { LIMITS } from '@/core/sched/workload';

import { alignedLanes } from './CompareView';
import {
  formatValue,
  presetFor,
  resultSentence,
  rowMarks,
  tryNextFor,
  variantOf,
} from './summary';

/** The same generators as the core's "Why?" property test (tests/compare.test.ts). */
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

describe('rowMarks (C2)', () => {
  it('marks a single best as best, shared bests as ties, and all-equal as all ties', () => {
    expect(rowMarks({ values: [3, 1, 2], better: 'lower' })).toEqual([
      null,
      'best',
      null,
    ]);
    expect(rowMarks({ values: [3, 1, 1], better: 'lower' })).toEqual([
      null,
      'tie',
      'tie',
    ]);
    expect(rowMarks({ values: [0.5, 0.5], better: 'higher' })).toEqual(['tie', 'tie']);
    expect(rowMarks({ values: [0.5, 0.75], better: 'higher' })).toEqual([null, 'best']);
  });

  it('ignores float noise, as the headline does', () => {
    expect(rowMarks({ values: [0.1 + 0.2, 0.3], better: 'lower' })).toEqual([
      'tie',
      'tie',
    ]);
  });

  it('the markers and the "Why?" headline name the same policies, on any input', () => {
    fc.assert(
      fc.property(
        workloadArb,
        fc.array(policyArb, { minLength: 2, maxLength: 4 }),
        (w, policies) => {
          const result = compare(w, policies);
          const line = whyLine(result.table, result.names);
          for (const part of whyParts(result.table, result.names)) {
            const row = result.table.find((r) => r.id === part.row)!;
            const marks = rowMarks(row);
            const marked = marks.flatMap((m, i) => (m ? [i] : []));
            expect(marked).toEqual(part.best);
            // A tie in the headline is a tie on the cells, and a sole winner is "best".
            const tied = part.best.length > 1;
            for (const i of part.best) expect(marks[i]).toBe(tied ? 'tie' : 'best');
            expect(line).toContain(tied ? 'tie' : result.names[part.best[0]!]!);
            // The marked value really is the best in the row.
            const values = row.values;
            const best =
              row.better === 'lower' ? Math.min(...values) : Math.max(...values);
            for (const i of marked) expect(values[i]!).toBeCloseTo(best, 9);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('formatValue', () => {
  it('shows utilisation as a percentage and the rest as numbers', () => {
    expect(formatValue('utilisation', 0.8333)).toBe('83.33%');
    expect(formatValue('waiting', 7.25)).toBe('7.25');
    expect(formatValue('contextSwitches', 3)).toBe('3');
  });
});

describe('end of run (G16)', () => {
  it('every preset suggests a different preset, and every preset is suggested', () => {
    const suggested = new Set<string>();
    for (const preset of COMPARE_PRESETS) {
      const input = { workload: preset.workload, policies: preset.policies };
      expect(presetFor(input)).toBe(preset.id);
      const next = tryNextFor(input);
      expect(next.preset.id).not.toBe(preset.id);
      expect(next.why.length).toBeGreaterThan(0);
      suggested.add(next.preset.id);
    }
    expect([...suggested].sort()).toEqual(COMPARE_PRESETS.map((p) => p.id).sort());
  });

  it('an edited input is no preset and still gets a suggestion', () => {
    const preset = COMPARE_PRESETS[0]!;
    const input = { workload: preset.workload, policies: [...preset.policies].reverse() };
    expect(presetFor(input)).toBeNull();
    expect(tryNextFor(input).preset.id).toBe('rr-sweep');
  });

  it('the result sentence says when the last run ended, then the headline', () => {
    expect(
      resultSentence(['FCFS', 'SJF'], 30, 'SJF has the lowest average waiting time.'),
    ).toBe(
      'All 2 runs have finished; the last one at t = 30. SJF has the lowest average waiting time.',
    );
  });
});

describe('variantOf (C4)', () => {
  it('doubles the RR quantum, or halves it at the cap', () => {
    expect(variantOf({ kind: 'rr', quantum: 2 })).toEqual({
      policy: { kind: 'rr', quantum: 4 },
      change: 'quantum 2 → 4',
    });
    expect(variantOf({ kind: 'rr', quantum: LIMITS.maxQuantum })?.policy).toEqual({
      kind: 'rr',
      quantum: LIMITS.maxQuantum / 2,
    });
  });

  it('flips priority preemption and swaps MLFQ rule 4', () => {
    expect(variantOf({ kind: 'priority', preemptive: false })?.policy).toEqual({
      kind: 'priority',
      preemptive: true,
    });
    const mlfq: Policy = {
      kind: 'mlfq',
      levels: [{ quantum: 2, allotment: 4 }],
      rule4: 'allotment',
    };
    expect(variantOf(mlfq)?.policy).toEqual({ ...mlfq, rule4: 'original' });
  });

  it('offers nothing for policies with no settings', () => {
    for (const kind of ['fcfs', 'sjf', 'srtf'] as const) {
      expect(variantOf({ kind })).toBeNull();
    }
  });
});

describe('alignedLanes (shared cursor)', () => {
  it('leaves single-lane charts alone', () => {
    expect(alignedLanes([{ kind: 'fcfs' }, { kind: 'rr', quantum: 2 }])).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('pads every lane label to the longest, so every chart has the same gutter', () => {
    const lanes = alignedLanes([
      { kind: 'rr', quantum: 4 },
      {
        kind: 'mlfq',
        levels: [
          { quantum: 2, allotment: 6 },
          { quantum: 4, allotment: 8 },
        ],
        rule4: 'allotment',
      },
    ]);
    const lengths = lanes.flatMap((l) => l!.map((lane) => lane.label.length));
    expect(new Set(lengths).size).toBe(1);
    expect(lanes[0]![0]!.label.trim()).toBe('CPU');
    expect(lanes[1]![0]!.label.trim()).toBe('Q0 (q = 2)');
  });
});
