import { describe, expect, it } from 'vitest';

import {
  LIMITS,
  policyName,
  SCHED_PRESETS,
  SCHED_SHARE_STATE,
  schedule,
  validatePolicy,
  validateWorkload,
} from '@/core/sched';
import { decodeShareState, encodeShareState } from '@/core/state/shareState';

import { burstsAtZero, proc, workload } from './helpers';

describe('workload schema', () => {
  it('accepts every preset', () => {
    for (const preset of SCHED_PRESETS) {
      expect(validateWorkload(preset.workload).ok, preset.id).toBe(true);
      expect(validatePolicy(preset.policy).ok, preset.id).toBe(true);
    }
  });

  it.each([
    ['no processes', workload([]), 'Add at least one process'],
    [
      'an even number of bursts',
      workload([proc('P1', 0, [1, 2])]),
      'start and end with CPU',
    ],
    ['a zero burst', workload([proc('P1', 0, [0])]), 'Each burst must be at least 1'],
    [
      'a duplicate PID',
      workload([proc('P1', 0, [1]), proc('P1', 0, [1])]),
      'different PID',
    ],
    ['a bad PID', workload([proc('P11', 0, [1])]), 'P1 to P10'],
    ['priority 10', workload([proc('P1', 0, [1], 10)]), 'Priority must be at most 9'],
    ['a negative arrival', workload([proc('P1', -1, [1])]), 'Arrival must be at least 0'],
    ['context switch 4', workload([proc('P1', 0, [1])], 4), 'at most 3'],
  ])('rejects %s with a readable message', (_name, input, message) => {
    const result = validateWorkload(input);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues.map((i) => i.message).join(' | ')).toContain(message);
  });

  it('points at the field that is wrong', () => {
    const result = validateWorkload(
      workload([proc('P1', 0, [1]), proc('P2', 0, [3, 0, 2])]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]!.path).toEqual(['processes', 1, 'bursts', 1]);
  });

  it(`allows at most ${LIMITS.maxProcesses} processes`, () => {
    const eleven = burstsAtZero(...Array(11).fill(1));
    expect(validateWorkload(eleven).ok).toBe(false);
  });
});

describe('policy schema', () => {
  it.each([
    [{ kind: 'rr', quantum: 0 }, 'Quantum must be at least 1'],
    [{ kind: 'rr', quantum: 11 }, 'Quantum must be at most 10'],
    [
      { kind: 'mlfq', levels: [{ quantum: 2, allotment: 2 }], rule4: 'allotment' },
      'at least 2',
    ],
    [{ kind: 'lottery' }, ''],
  ])('rejects %j', (input, message) => {
    const result = validatePolicy(input);
    expect(result.ok).toBe(false);
    if (!result.ok && message) {
      expect(result.issues.map((i) => i.message).join(' | ')).toContain(message);
    }
  });

  it('names policies', () => {
    expect(policyName({ kind: 'rr', quantum: 4 })).toBe('RR q=4');
    expect(
      policyName({ kind: 'priority', preemptive: true, aging: { every: 2, by: 1 } }),
    ).toBe('Priority (preemptive, aging)');
  });
});

describe('share state', () => {
  it('round-trips the workload, the policy and the step', () => {
    const preset = SCHED_PRESETS.find((p) => p.id === 'mlfq-boost')!;
    const state = {
      ...SCHED_SHARE_STATE.defaults,
      step: 12,
      input: { workload: preset.workload, policy: preset.policy },
    };
    expect(
      decodeShareState(SCHED_SHARE_STATE, encodeShareState(SCHED_SHARE_STATE, state)),
    ).toStrictEqual(state);
  });

  it('fits the largest workload in a link', () => {
    const big = workload(
      Array.from({ length: 10 }, (_, i) => proc(`P${i + 1}`, 100, Array(9).fill(50), 9)),
      3,
    );
    const state = {
      ...SCHED_SHARE_STATE.defaults,
      step: 300,
      input: {
        workload: big,
        policy: {
          kind: 'mlfq' as const,
          levels: Array(4).fill({ quantum: 10, allotment: 50 }),
          boostEvery: 300,
          rule4: 'allotment' as const,
        },
      },
    };
    expect(encodeShareState(SCHED_SHARE_STATE, state)).not.toBeNull();
  });
});

describe('events', () => {
  it('every dispatch and preempt says why, and a phase starts at each dispatch', () => {
    for (const preset of SCHED_PRESETS) {
      const run = schedule(preset.workload, preset.policy);
      const dispatches = run.events.filter((e) => e.kind === 'sched.dispatch');
      for (const e of [
        ...dispatches,
        ...run.events.filter((x) => x.kind === 'sched.preempt'),
      ]) {
        expect(e.label, preset.id).toMatch(
          /^P\d+ (runs|preempts|in Q\d preempts) ?.*: .+/,
        );
      }
      const runPhases = run.phases.filter((p) => p.id.startsWith('run-'));
      expect(runPhases.map((p) => p.startMs)).toEqual(dispatches.map((e) => e.at));
      for (const phase of runPhases) {
        expect(phase.title).toMatch(/^P\d+ runs, t = \d+–\d+$/);
      }
    }
  });

  it('events are in tick order and the final snapshot has every process done', () => {
    for (const preset of SCHED_PRESETS) {
      const run = schedule(preset.workload, preset.policy);
      const ats = run.events.map((e) => e.at);
      expect([...ats].sort((a, b) => a - b)).toEqual(ats);
      const last = run.events[run.events.length - 1]!;
      expect(last.state.done).toHaveLength(preset.workload.processes.length);
      expect(last.at).toBe(run.durationMs);
    }
  });
});
