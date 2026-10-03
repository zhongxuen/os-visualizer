import { describe, expect, it } from 'vitest';

import { presetById } from '@/core/sched';

import { burstsAtZero, layout, proc, run, workload } from './helpers';

/**
 * Silberschatz, Galvin, Gagne, *Operating System Concepts*, 10th ed., §5.3 worked
 * examples. Recorded in tests/fixtures/README.md.
 */
describe('OSC10 §5.3.1 FCFS', () => {
  it('P1 = 24, P2 = 3, P3 = 3 at t = 0: average waiting 17', () => {
    const { metrics, segments } = run(burstsAtZero(24, 3, 3), { kind: 'fcfs' });
    expect(layout(segments)).toBe('P1[0-24) P2[24-27) P3[27-30)');
    expect(metrics.processes.map((p) => p.waiting)).toEqual([0, 24, 27]);
    expect(metrics.avgWaiting).toBe(17);
  });

  it('in the order P2, P3, P1 (the short jobs first): average waiting 3', () => {
    // Same bursts, renamed so arrival order is 3, 3, 24 under the lowest-PID rule.
    const { metrics } = run(burstsAtZero(3, 3, 24), { kind: 'fcfs' });
    expect(metrics.avgWaiting).toBe(3);
  });
});

describe('OSC10 §5.3.2 SJF and SRTF', () => {
  it('SJF P1 = 6, P2 = 8, P3 = 7, P4 = 3: average waiting 7', () => {
    const { metrics, segments } = run(burstsAtZero(6, 8, 7, 3), { kind: 'sjf' });
    expect(layout(segments)).toBe('P4[0-3) P1[3-9) P3[9-16) P2[16-24)');
    expect(metrics.processes.map((p) => p.waiting)).toEqual([3, 16, 9, 0]);
    expect(metrics.avgWaiting).toBe(7);
  });

  it('SRTF arrivals 0, 1, 2, 3, bursts 8, 4, 9, 5: average waiting 6.5', () => {
    const w = workload([
      proc('P1', 0, [8]),
      proc('P2', 1, [4]),
      proc('P3', 2, [9]),
      proc('P4', 3, [5]),
    ]);
    const { metrics, segments, kinds } = run(w, { kind: 'srtf' });
    expect(layout(segments)).toBe('P1[0-1) P2[1-5) P4[5-10) P1[10-17) P3[17-26)');
    expect(metrics.processes.map((p) => p.waiting)).toEqual([9, 0, 15, 2]);
    expect(metrics.avgWaiting).toBe(6.5);
    expect(kinds('sched.preempt').map((e) => e.label)).toEqual([
      'P2 preempts P1: 4 ticks left < 7',
    ]);
  });
});

describe('OSC10 §5.3.3 Round robin', () => {
  it('q = 4, P1 = 24, P2 = 3, P3 = 3: average waiting 17/3', () => {
    const { metrics, segments } = run(burstsAtZero(24, 3, 3), { kind: 'rr', quantum: 4 });
    expect(layout(segments)).toBe('P1[0-4) P2[4-7) P3[7-10) P1[10-30)');
    expect(metrics.processes.map((p) => p.waiting)).toEqual([6, 4, 7]);
    expect(metrics.avgWaiting).toBeCloseTo(17 / 3, 10);
  });
});

describe('OSC10 §5.3.4 Priority', () => {
  it('bursts 10, 1, 2, 1, 5 with priorities 3, 1, 4, 5, 2: average waiting 8.2', () => {
    const w = workload([
      proc('P1', 0, [10], 3),
      proc('P2', 0, [1], 1),
      proc('P3', 0, [2], 4),
      proc('P4', 0, [1], 5),
      proc('P5', 0, [5], 2),
    ]);
    const { metrics, segments } = run(w, { kind: 'priority', preemptive: false });
    expect(layout(segments)).toBe('P2[0-1) P5[1-6) P1[6-16) P3[16-18) P4[18-19)');
    expect(metrics.processes.map((p) => p.waiting)).toEqual([6, 0, 16, 18, 1]);
    expect(metrics.avgWaiting).toBeCloseTo(8.2, 10);
  });
});

describe('the OSC10 presets reproduce the fixtures', () => {
  it.each([
    ['osc-fcfs', 17],
    ['osc-sjf', 7],
    ['osc-srtf', 6.5],
    ['osc-rr', 17 / 3],
    ['osc-priority', 8.2],
  ])('%s: average waiting %d', (id, expected) => {
    const preset = presetById(id)!;
    expect(run(preset.workload, preset.policy).metrics.avgWaiting).toBeCloseTo(
      expected,
      10,
    );
  });
});
