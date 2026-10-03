import { describe, expect, it } from 'vitest';

import { burstsAtZero, layout, proc, run, workload } from './helpers';

/**
 * OSTEP v1.10 ch. 7 (Scheduling: Introduction). A, B, C are P1, P2, P3. Recorded in
 * tests/fixtures/README.md.
 */
describe('OSTEP §7.3–7.4 FIFO and SJF (A = 100, B = C = 10)', () => {
  const abc = burstsAtZero(100, 10, 10);

  it('FIFO: average turnaround 110', () => {
    const { metrics } = run(abc, { kind: 'fcfs' });
    expect(metrics.processes.map((p) => p.turnaround)).toEqual([100, 110, 120]);
    expect(metrics.avgTurnaround).toBe(110);
  });

  it('SJF: average turnaround 50', () => {
    const { metrics, segments } = run(abc, { kind: 'sjf' });
    expect(layout(segments)).toBe('P2[0-10) P3[10-20) P1[20-120)');
    expect(metrics.avgTurnaround).toBe(50);
  });
});

describe('OSTEP §7.5 STCF', () => {
  it('A = 100 at 0, B = C = 10 at 10: average turnaround 50', () => {
    const w = workload([
      proc('P1', 0, [100]),
      proc('P2', 10, [10]),
      proc('P3', 10, [10]),
    ]);
    const { metrics, segments } = run(w, { kind: 'srtf' });
    expect(layout(segments)).toBe('P1[0-10) P2[10-20) P3[20-30) P1[30-120)');
    expect(metrics.processes.map((p) => p.turnaround)).toEqual([120, 10, 20]);
    expect(metrics.avgTurnaround).toBe(50);
  });
});

describe('OSTEP §7.6–7.7 response time, RR vs SJF (A = B = C = 5)', () => {
  const abc = burstsAtZero(5, 5, 5);

  it('RR with a 1-tick slice: average response 1', () => {
    const { metrics } = run(abc, { kind: 'rr', quantum: 1 });
    expect(metrics.processes.map((p) => p.response)).toEqual([0, 1, 2]);
    expect(metrics.avgResponse).toBe(1);
  });

  it('SJF: average response 5', () => {
    const { metrics } = run(abc, { kind: 'sjf' });
    expect(metrics.processes.map((p) => p.response)).toEqual([0, 5, 10]);
    expect(metrics.avgResponse).toBe(5);
  });
});
