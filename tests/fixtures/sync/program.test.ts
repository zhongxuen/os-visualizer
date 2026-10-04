import { describe, expect, it } from 'vitest';

import { encodeShareState, MAX_SHARE_STATE_LENGTH } from '@/core/state';
import {
  counterProgram,
  describeSchedule,
  formatOp,
  LIMITS,
  registersOf,
  SYNC_PRESETS,
  SYNC_SHARE_STATE,
  validateProgram,
  type Op,
} from '@/core/sync';

describe('formatOp', () => {
  it.each<[Op, string]>([
    [{ op: 'load', reg: 'r', var: 'counter' }, 'load r, counter'],
    [{ op: 'add', reg: 'r', k: 1 }, 'add r, 1'],
    [{ op: 'add', reg: 'r', k: -1 }, 'add r, -1'],
    [{ op: 'store', var: 'counter', reg: 'r' }, 'store counter, r'],
    [{ op: 'lock', m: 'm' }, 'lock m'],
    [{ op: 'unlock', m: 'm' }, 'unlock m'],
    [{ op: 'wait', s: 'empty' }, 'wait empty'],
    [{ op: 'signal', s: 'full' }, 'signal full'],
    [{ op: 'yield' }, 'yield'],
  ])('%j → %s', (op, text) => {
    expect(formatOp(op)).toBe(text);
  });
});

describe('describeSchedule', () => {
  it('names each kind', () => {
    expect(describeSchedule({ kind: 'manual', picks: [0, 1] })).toBe('Manual, 2 picks');
    expect(describeSchedule({ kind: 'rr', quantum: 2 })).toBe('Round robin, quantum 2');
    expect(describeSchedule({ kind: 'random', seed: 7 })).toBe('Seeded random, seed 7');
  });
});

describe('validateProgram', () => {
  it('accepts every preset', () => {
    for (const preset of SYNC_PRESETS) {
      expect(validateProgram(preset.program), preset.id).toEqual({
        ok: true,
        value: preset.program,
      });
    }
  });

  function messages(input: unknown): string[] {
    const v = validateProgram(input);
    return v.ok ? [] : v.issues.map((issue) => issue.message);
  }

  it('names a reference to something undeclared', () => {
    const program = counterProgram();
    program.threads[0]!.ops.push({ op: 'lock', m: 'nope' }, { op: 'wait', s: 'gone' });
    program.threads[1]!.ops.push({ op: 'load', reg: 'r', var: 'y' });
    expect(messages(program)).toEqual([
      'There is no lock called nope',
      'There is no semaphore called gone',
      'There is no variable called y',
    ]);
  });

  it('rejects a name used twice', () => {
    const program = { ...counterProgram(), locks: ['counter'] };
    expect(messages(program)).toEqual(['counter is already the name of a variable']);
  });

  it('enforces the limits', () => {
    const program = counterProgram();
    expect(messages({ ...program, threads: [] })).toEqual(['Add at least one thread']);
    expect(
      messages({
        ...program,
        threads: Array.from({ length: 4 }, () => program.threads[0]),
      }),
    ).toEqual([`At most ${LIMITS.maxThreads} threads`]);
    expect(messages({ ...program, threads: [{ ops: [] }] })).toEqual([
      'A thread needs at least one op',
    ]);
    expect(messages({ ...program, vars: [{ name: '1x', init: 0 }] })[0]).toMatch(
      /A name is a letter/,
    );
    expect(messages({ ...program, sems: [{ name: 's', init: -1 }] })).toEqual([
      'A semaphore must be at least 0',
    ]);
  });

  it('checks bounds and expectations', () => {
    const program = {
      ...counterProgram(),
      expect: [{ var: 'z', value: 1 }],
      bounds: [{ var: 'counter', min: 3, max: 1 }],
    };
    expect(messages(program)).toEqual([
      'There is no variable called z',
      'The bound on counter has min 3 above max 1',
    ]);
  });
});

describe('registersOf', () => {
  it('lists registers in order of first use', () => {
    expect(
      registersOf({
        ops: [
          { op: 'load', reg: 'b', var: 'x' },
          { op: 'add', reg: 'a', k: 1 },
          { op: 'store', var: 'x', reg: 'b' },
        ],
      }),
    ).toEqual(['b', 'a']);
  });
});

describe('share state', () => {
  it('every preset with a 60-pick manual schedule fits in a link', () => {
    for (const preset of SYNC_PRESETS) {
      const encoded = encodeShareState(SYNC_SHARE_STATE, {
        m: 'sync',
        v: 1,
        step: 60,
        input: {
          preset: preset.id,
          program: preset.program,
          schedule: {
            kind: 'manual',
            picks: Array.from({ length: 60 }, (_, i) => i % 2),
          },
        },
      });
      expect(encoded, preset.id).not.toBeNull();
      expect(encoded!.length).toBeLessThanOrEqual(MAX_SHARE_STATE_LENGTH);
    }
  });
});
