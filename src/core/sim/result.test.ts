import { describe, expect, it } from 'vitest';

import { timelineFrom } from './playback';
import { summarizePhases, type SimResult } from './result';

describe('summarizePhases', () => {
  const starts = [
    { at: 0, id: 'a', title: 'A', description: 'first' },
    { at: 40, id: 'b', title: 'B', description: 'second', plain: 'in plain words' },
  ];

  it('ends each phase where the next begins and the last at durationMs', () => {
    expect(summarizePhases(starts, 100)).toStrictEqual([
      { index: 0, id: 'a', title: 'A', description: 'first', startMs: 0, endMs: 40 },
      {
        index: 1,
        id: 'b',
        title: 'B',
        description: 'second',
        startMs: 40,
        endMs: 100,
        plain: 'in plain words',
      },
    ]);
  });

  it('never produces a negative last phase', () => {
    expect(summarizePhases(starts, 10)[1]?.endMs).toBe(40);
  });

  it('omits plain rather than setting it to undefined', () => {
    expect('plain' in summarizePhases(starts, 100)[0]!).toBe(false);
  });

  it('returns no phases for no starts', () => {
    expect(summarizePhases([], 100)).toStrictEqual([]);
  });
});

describe('vendored timelineFrom with the local SimResult', () => {
  it('accepts a result typed with module events', () => {
    const result: SimResult<{ at: number; kind: 'x' }> = {
      events: [
        { at: 0, kind: 'x' },
        { at: 0, kind: 'x' },
        { at: 30, kind: 'x' },
      ],
      phases: summarizePhases([{ at: 0, id: 'p', title: 'P', description: 'd' }], 60),
      durationMs: 60,
    };

    expect(timelineFrom(result)).toStrictEqual({
      durationMs: 60,
      phaseStarts: [0],
      eventTimes: [0, 30],
    });
  });
});
