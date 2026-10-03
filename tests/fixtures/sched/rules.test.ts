import { describe, expect, it } from 'vitest';

import { presetById, rulesFor, SCHED_RULES } from '@/core/sched';
import { runKernel } from '@/core/sched/kernel';

import { layout, proc, run, workload } from './helpers';

/**
 * One test per rule in `src/core/sched/rules.ts`, named after the rule id. The last test
 * checks the list and the tests stay in step.
 */

const TESTED = new Set<string>();
function rule(id: string, body: () => void) {
  TESTED.add(id);
  it(id, body);
}

describe('scheduling rules', () => {
  rule('sched.order.arrivals', () => {
    // Listed out of order on purpose; P2 must come before P10 (numeric PID order).
    const w = workload([proc('P10', 0, [1]), proc('P2', 0, [1]), proc('P1', 0, [1])]);
    const { kinds, segments } = run(w, { kind: 'fcfs' });
    expect(kinds('sched.arrive').map((e) => e.pid)).toEqual(['P1', 'P2', 'P10']);
    expect(layout(segments)).toBe('P1[0-1) P2[1-2) P10[2-3)');
  });

  rule('sched.order.io', () => {
    // At t = 3, P2 arrives and P1 returns from I/O: the arrival goes first.
    const w = workload([
      proc('P1', 0, [1, 2, 1]),
      proc('P2', 3, [1]),
      proc('P3', 0, [10]),
    ]);
    const { kinds } = run(w, { kind: 'fcfs' });
    const back = kinds('sched.ioDone')[0]!;
    expect(back.tick).toBe(3);
    expect(back.state.queues[0]).toEqual(['P2', 'P1']);
  });

  rule('sched.order.quantum', () => {
    // P1's quantum expires at t = 2, the tick P2 arrives: P2 goes ahead of P1.
    const w = workload([proc('P1', 0, [4]), proc('P2', 2, [2])]);
    const { segments, kinds } = run(w, { kind: 'rr', quantum: 2 });
    expect(layout(segments)).toBe('P1[0-2) P2[2-4) P1[4-6)');
    expect(kinds('sched.quantumExpired')[0]!.state.queues[0]).toEqual(['P2', 'P1']);
  });

  rule('sched.order.finish', () => {
    const w = workload([proc('P1', 0, [2]), proc('P2', 0, [2])]);
    const { kinds } = run(w, { kind: 'rr', quantum: 2 });
    expect(kinds('sched.quantumExpired')).toEqual([]);
    expect(kinds('sched.finish').map((e) => [e.pid, e.tick])).toEqual([
      ['P1', 2],
      ['P2', 4],
    ]);
  });

  rule('sched.tie.pid', () => {
    const sjf = run(workload([proc('P2', 0, [3]), proc('P1', 0, [3])]), { kind: 'sjf' });
    const dispatch = sjf.kinds('sched.dispatch')[0]!;
    expect(dispatch.pid).toBe('P1');
    expect(dispatch.label).toContain('tie with P2 goes to the lower PID');

    const priority = run(workload([proc('P3', 0, [1], 2), proc('P1', 0, [1], 2)]), {
      kind: 'priority',
      preemptive: false,
    });
    expect(priority.kinds('sched.dispatch')[0]!.pid).toBe('P1');
  });

  rule('sched.preempt.equal', () => {
    // At t = 1 both have 3 ticks left: SRTF keeps P1.
    const srtf = run(workload([proc('P1', 0, [4]), proc('P2', 1, [3])]), {
      kind: 'srtf',
    });
    expect(srtf.kinds('sched.preempt')).toEqual([]);
    expect(layout(srtf.segments)).toBe('P1[0-4) P2[4-7)');

    const priority = run(workload([proc('P1', 0, [4], 2), proc('P2', 1, [3], 2)]), {
      kind: 'priority',
      preemptive: true,
    });
    expect(priority.kinds('sched.preempt')).toEqual([]);
  });

  rule('sched.preempt.tail', () => {
    const w = workload([
      proc('P1', 0, [5], 3),
      proc('P2', 0, [5], 3),
      proc('P3', 1, [2], 1),
    ]);
    const { kinds } = run(w, { kind: 'priority', preemptive: true });
    const preempt = kinds('sched.preempt')[0]!;
    expect([preempt.pid, preempt.other]).toEqual(['P3', 'P1']);
    expect(preempt.state.queues[0]).toEqual(['P2', 'P3', 'P1']);
  });

  rule('sched.cs.cost', () => {
    const two = run(workload([proc('P1', 0, [2]), proc('P2', 0, [2])], 2), {
      kind: 'fcfs',
    });
    // The first dispatch is free; the switch to P2 costs 2 ticks.
    expect(layout(two.segments)).toBe('P1[0-2) cs[2-4) P2[4-6)');
    expect(two.metrics.busyTicks).toBe(4);
    expect(two.metrics.csTicks).toBe(2);
    expect(two.metrics.idleTicks).toBe(0);
    expect(two.metrics.utilisation).toBeCloseTo(4 / 6, 10);
    expect(two.metrics.contextSwitches).toBe(1);
    // CS time counts as waiting.
    expect(two.metrics.processes[1]!.waiting).toBe(4);

    // The same process coming back after idle time is not a switch.
    const same = run(workload([proc('P1', 0, [1, 2, 1])], 2), { kind: 'fcfs' });
    expect(layout(same.segments)).toBe('P1[0-1) idle[1-3) P1[3-4)');
  });

  rule('sched.cs.atomic', () => {
    // P2 preempts P1 at t = 1. P3 arrives at t = 2, the instant the switch to P2
    // completes: P2 still runs one tick before P3 can preempt it.
    const w = workload([proc('P1', 0, [10]), proc('P2', 1, [5]), proc('P3', 2, [1])], 1);
    const { segments } = run(w, { kind: 'srtf' });
    expect(layout(segments).startsWith('P1[0-1) cs[1-2) P2[2-3) cs[3-4) P3[4-5)')).toBe(
      true,
    );
  });

  rule('sched.priority.lower', () => {
    const w = workload([proc('P1', 0, [2], 5), proc('P2', 0, [2], 1)]);
    const { segments } = run(w, { kind: 'priority', preemptive: false });
    expect(layout(segments)).toBe('P2[0-2) P1[2-4)');
  });

  rule('sched.priority.aging', () => {
    const preset = presetById('priority-aging')!;
    const aged = run(preset.workload, preset.policy);
    const ages = aged.kinds('sched.age').filter((e) => e.pid === 'P1');
    expect(ages.map((e) => e.state.priorities!.P1)).toEqual([7, 5, 3, 1]);
    expect(aged.segments.find((s) => s.pid === 'P1')!.start).toBe(9);
    // Reset to the base priority when it runs.
    const dispatch = aged.kinds('sched.dispatch').find((e) => e.pid === 'P1')!;
    expect(dispatch.state.priorities!.P1).toBe(9);

    const without = presetById('priority-starvation')!;
    expect(
      run(without.workload, without.policy).segments.find((s) => s.pid === 'P1')!.start,
    ).toBe(18);

    // Floored at 0.
    const floored = run(workload([proc('P1', 0, [6], 0), proc('P2', 0, [2], 3)]), {
      kind: 'priority',
      preemptive: false,
      aging: { every: 1, by: 9 },
    });
    const priorities = floored.events.flatMap((e) => Object.values(e.state.priorities!));
    expect(Math.min(...priorities)).toBe(0);
  });

  rule('sched.sjf.next', () => {
    // P1's next burst (2) is shorter than P2's (5), although its total CPU is longer.
    const w = workload([proc('P1', 0, [2, 1, 10]), proc('P2', 0, [5])]);
    const { kinds } = run(w, { kind: 'sjf' });
    expect(kinds('sched.dispatch')[0]!.label).toBe('P1 runs: shortest next burst (2)');
  });

  rule('sched.io.fixed', () => {
    const { segments, kinds } = run(workload([proc('P1', 0, [1, 3, 1])]), {
      kind: 'fcfs',
    });
    expect(kinds('sched.ioStart')[0]!.tick).toBe(1);
    expect(kinds('sched.ioDone')[0]!.tick).toBe(4);
    expect(layout(segments)).toBe('P1[0-1) idle[1-4) P1[4-5)');
  });

  rule('sched.mlfq.enter', () => {
    const w = workload([proc('P1', 0, [10]), proc('P2', 3, [1])]);
    const levels = [
      { quantum: 2, allotment: 2 },
      { quantum: 4, allotment: 4 },
    ];
    const { segments, kinds } = run(w, { kind: 'mlfq', levels, rule4: 'allotment' });
    expect(kinds('sched.arrive')[1]!.state.queues[0]).toEqual(['P2']);
    expect(kinds('sched.preempt')[0]!.label).toContain('rule 1');
    expect(layout(segments)).toBe('P1@0[0-2) P1@1[2-3) P2@0[3-4) P1@1[4-11)');
  });

  rule('sched.mlfq.allotment', () => {
    const preset = presetById('mlfq-gaming-new')!;
    const { kinds } = run(preset.workload, preset.policy);
    const demoted = kinds('sched.demote').find((e) => e.pid === 'P2')!;
    // P2 runs 3 ticks, does I/O, then 1 more: 4 = its allotment, counted across I/O.
    expect(demoted.tick).toBe(9);
    expect(demoted.level).toBe(1);
  });

  rule('sched.mlfq.original', () => {
    const preset = presetById('mlfq-gaming-old')!;
    const { segments } = run(preset.workload, preset.policy);
    expect(segments.filter((s) => s.pid === 'P2').every((s) => s.level === 0)).toBe(true);

    // Finishing a burst on the last tick of the quantum counts as using it all.
    const levels = [
      { quantum: 2, allotment: 2 },
      { quantum: 2, allotment: 2 },
    ];
    const exact = run(workload([proc('P1', 0, [2, 1, 1])]), {
      kind: 'mlfq',
      levels,
      rule4: 'original',
    });
    expect(layout(exact.segments)).toBe('P1@0[0-2) idle[2-3) P1@1[3-4)');
  });

  rule('sched.mlfq.boost', () => {
    const preset = presetById('mlfq-boost')!;
    const { kinds } = run(preset.workload, preset.policy);
    const boosts = kinds('sched.boost');
    expect(boosts.map((e) => e.tick)).toEqual([5, 10, 15, 20, 25]);
    for (const boost of boosts) {
      expect(Object.values(boost.state.levels!).every((level) => level === 0)).toBe(true);
      expect(boost.state.queues.slice(1).every((q) => q.length === 0)).toBe(true);
    }
  });

  rule('sched.limit', () => {
    const many = workload(
      Array.from({ length: 10 }, (_, i) => proc(`P${i + 1}`, 0, [50])),
    );
    const { kinds, metrics, result } = run(many, { kind: 'fcfs' });
    const limit = kinds('sched.limit');
    expect(limit).toHaveLength(1);
    expect(limit[0]!.tick).toBe(300);
    expect(result.durationMs).toBe(300_000);
    expect(metrics.complete).toBe(false);
    // The option exists for tests, and the event names it.
    expect(
      runKernel(many, { kind: 'fcfs' }, { maxTicks: 20 }).events.at(-1)!.label,
    ).toContain('20-tick limit');
  });

  it('every rule in rules.ts has a test here, and rulesFor filters by policy', () => {
    expect(SCHED_RULES.map((r) => r.id).filter((id) => !TESTED.has(id))).toEqual([]);
    expect(new Set(SCHED_RULES.map((r) => r.id)).size).toBe(SCHED_RULES.length);
    expect(rulesFor('fcfs').some((r) => r.id === 'sched.mlfq.boost')).toBe(false);
    expect(rulesFor('mlfq').some((r) => r.id === 'sched.mlfq.boost')).toBe(true);
  });
});
