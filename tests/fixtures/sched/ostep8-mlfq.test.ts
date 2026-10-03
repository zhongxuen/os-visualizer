import { describe, expect, it } from 'vitest';

import type { Policy } from '@/core/sched';

import { layout, proc, run, workload } from './helpers';

/**
 * OSTEP v1.10 ch. 8 (MLFQ) figures, with the chapter's 10 ms quantum as 10 ticks and
 * three queues. OSTEP draws Q2 at the top; here level 0 is the top. Recorded in
 * tests/fixtures/README.md.
 */

const LEVELS = [
  { quantum: 10, allotment: 10 },
  { quantum: 10, allotment: 10 },
  { quantum: 10, allotment: 10 },
];

function mlfq(rule4: 'allotment' | 'original', boostEvery?: number): Policy {
  return boostEvery === undefined
    ? { kind: 'mlfq', levels: LEVELS, rule4 }
    : { kind: 'mlfq', levels: LEVELS, rule4, boostEvery };
}

describe('OSTEP Figure 8.2: a single long-running job', () => {
  it('moves down a queue after each quantum and stays at the bottom', () => {
    const { segments } = run(workload([proc('P1', 0, [200])]), mlfq('original'));
    expect(layout(segments)).toBe('P1@0[0-10) P1@1[10-20) P1@2[20-200)');
  });
});

describe('OSTEP Figure 8.3: along came a short job', () => {
  it('the short job enters at the top, preempts and finishes in two quanta', () => {
    const w = workload([proc('P1', 0, [180]), proc('P2', 100, [20])]);
    const { segments } = run(w, mlfq('original'));
    expect(layout(segments)).toBe(
      'P1@0[0-10) P1@1[10-20) P1@2[20-100) P2@0[100-110) P2@1[110-120) P1@2[120-200)',
    );
  });
});

describe('OSTEP Figure 8.4: a mixed I/O-intensive and CPU-intensive workload', () => {
  it('the interactive job runs 1 tick at a time and keeps the top queue', () => {
    const w = workload([
      proc('P1', 0, [150]),
      proc('P2', 50, [1, 9, 1, 9, 1, 9, 1, 9, 1]),
    ]);
    const { segments, metrics } = run(w, mlfq('original'));
    const interactive = segments.filter((s) => s.pid === 'P2');
    expect(interactive).toHaveLength(5);
    expect(interactive.every((s) => s.level === 0 && s.end - s.start === 1)).toBe(true);
    // It runs the moment it is ready: on arrival and on every return from I/O.
    expect(interactive.map((s) => s.start)).toEqual([50, 60, 70, 80, 90]);
    expect(metrics.processes[1]!.waiting).toBe(0);
  });
});

describe('OSTEP Figure 8.5: without and with priority boost', () => {
  const w = workload([
    proc('P1', 0, [120]),
    proc('P2', 100, [1, 1, 1, 1, 1, 1, 1, 1, 1]),
    proc('P3', 100, [1, 1, 1, 1, 1, 1, 1, 1, 1]),
  ]);

  it('without a boost the long job starves while the interactive jobs run', () => {
    const { segments } = run(w, mlfq('original'));
    const lastShort = Math.max(
      ...segments.filter((s) => s.pid !== 'P1').map((s) => s.end),
    );
    const starved = segments.filter(
      (s) => s.pid === 'P1' && s.start >= 100 && s.start < lastShort,
    );
    expect(starved).toEqual([]);
  });

  it('with a boost the long job is lifted to the top queue and runs', () => {
    const { segments, kinds } = run(w, mlfq('original', 5));
    expect(kinds('sched.boost').length).toBeGreaterThan(0);
    const lastShort = Math.max(
      ...segments.filter((s) => s.pid !== 'P1').map((s) => s.end),
    );
    const lifted = segments.filter(
      (s) => s.pid === 'P1' && s.start >= 100 && s.start < lastShort,
    );
    expect(lifted.length).toBeGreaterThan(0);
    expect(lifted.every((s) => s.level === 0)).toBe(true);
  });
});

describe('OSTEP Figure 8.6: without and with gaming tolerance', () => {
  const w = workload([proc('P1', 0, [100]), proc('P2', 20, [9, 1, 9, 1, 9, 1, 9, 1, 9])]);

  it('old rules 4a/4b: the job that does I/O after 9 of 10 ticks keeps the top queue', () => {
    const { segments, metrics } = run(w, mlfq('original'));
    const gamer = segments.filter((s) => s.pid === 'P2');
    expect(gamer.every((s) => s.level === 0)).toBe(true);
    // It holds the CPU for 9 of every 10 ticks while it runs.
    expect(metrics.processes[1]!.turnaround).toBe(49);
  });

  it('new rule 4 (allotment): the same job is moved down once it has used 10 ticks', () => {
    const { segments, kinds } = run(w, mlfq('allotment'));
    const gamer = segments.filter((s) => s.pid === 'P2');
    expect(gamer.some((s) => (s.level ?? 0) > 0)).toBe(true);
    expect(kinds('sched.demote').some((e) => e.pid === 'P2')).toBe(true);
  });
});
