import { describe, expect, it } from 'vitest';

import { timelineFrom } from '../sim/playback';
import { createRun, STEP_MS, TICK_MS } from './builder';
import type { EventBase, OsEvent } from './types';

type TestEvent = EventBase & { kind: 'test.event'; value: number };

function event(id: string, value = 0) {
  return {
    kind: 'test.event',
    id,
    label: `event ${id}`,
    citation: 'ostep.4',
    value,
  } as const;
}

describe('createRun', () => {
  it('uses 1000 ms ticks and 800 ms steps', () => {
    expect(TICK_MS).toBe(1000);
    expect(STEP_MS).toBe(800);

    const ticks = createRun<TestEvent>({ unit: 'tick' });
    ticks.advance(3);
    expect(ticks.at).toBe(3000);

    const steps = createRun<TestEvent>({ unit: 'step' });
    steps.advance(3);
    expect(steps.at).toBe(2400);
  });

  it('stamps events with the current position and lets several share a tick', () => {
    const run = createRun<TestEvent>({ unit: 'tick' });
    run.emit(event('a'));
    run.emit(event('b'));
    run.advance();
    run.emit(event('c'));
    run.advance();

    const result = run.finish();
    expect(result.events.map((e) => [e.id, e.at])).toEqual([
      ['a', 0],
      ['b', 0],
      ['c', 1000],
    ]);
    expect(result.durationMs).toBe(2000);
  });

  it('starts phases at the current position as half-open intervals', () => {
    const run = createRun<TestEvent>({ unit: 'step' });
    run.phase('one', 'One', 'first');
    run.emit(event('a'));
    run.advance(2);
    run.phase('two', 'Two', 'second', 'plain');
    run.emit(event('b'));
    run.advance();

    expect(run.finish().phases).toStrictEqual([
      {
        index: 0,
        id: 'one',
        title: 'One',
        description: 'first',
        startMs: 0,
        endMs: 1600,
      },
      {
        index: 1,
        id: 'two',
        title: 'Two',
        description: 'second',
        startMs: 1600,
        endMs: 2400,
        plain: 'plain',
      },
    ]);
  });

  it('rejects duplicate event and phase ids and bad advances', () => {
    const run = createRun<TestEvent>({ unit: 'tick' });
    run.emit(event('a'));
    expect(() => run.emit(event('a'))).toThrow(/Duplicate event id/);
    run.phase('p', 'P', 'd');
    expect(() => run.phase('p', 'P', 'd')).toThrow(/Duplicate phase id/);
    expect(() => run.advance(-1)).toThrow(RangeError);
    expect(() => run.advance(0.5)).toThrow(RangeError);
  });

  it('returns a result that survives a JSON round trip', () => {
    const run = createRun<TestEvent>({ unit: 'tick' });
    run.phase('p', 'P', 'd');
    run.emit(event('a', 7));
    run.advance();
    const result = run.finish();
    expect(JSON.parse(JSON.stringify(result))).toStrictEqual(result);
  });

  it('does not let a finished result change when the builder continues', () => {
    const run = createRun<TestEvent>({ unit: 'tick' });
    run.emit(event('a'));
    const first = run.finish();
    run.emit(event('b'));
    expect(first.events).toHaveLength(1);
  });

  it.each(['tick', 'step'] as const)(
    'produces a %s run the vendored timelineFrom accepts',
    (unit) => {
      const run = createRun<OsEvent>({ unit });
      run.phase('start', 'Start', 'd');
      run.emit({
        kind: 'deadlock.placeholder',
        id: 'a',
        label: 'a',
        citation: 'ostep.4',
      });
      run.advance();
      run.phase('next', 'Next', 'd');
      run.emit({
        kind: 'deadlock.placeholder',
        id: 'b',
        label: 'b',
        citation: 'ostep.4',
      });
      run.emit({
        kind: 'deadlock.placeholder',
        id: 'c',
        label: 'c',
        citation: 'ostep.4',
      });
      run.advance();

      const ms = unit === 'tick' ? TICK_MS : STEP_MS;
      expect(timelineFrom(run.finish())).toStrictEqual({
        durationMs: 2 * ms,
        phaseStarts: [0, ms],
        eventTimes: [0, ms],
      });
    },
  );
});
