import { describe, expect, it } from 'vitest';

import { STEP_MS, TICK_MS } from '@/core/events/builder';

import {
  formatDuration,
  formatTimecode,
  formatTotal,
  formatValueText,
  percentOf,
  snapToUnit,
  unitCount,
  unitIndex,
} from './time';

describe('formatTimecode', () => {
  it('prints ticks as a point in time, never milliseconds', () => {
    const duration = 23 * TICK_MS;
    expect(formatTimecode(0, duration, 'tick')).toBe('t = 0');
    expect(formatTimecode(7 * TICK_MS, duration, 'tick')).toBe('t = 7');
    // Inside tick 7 is still t = 7: the playhead is between decisions.
    expect(formatTimecode(7.6 * TICK_MS, duration, 'tick')).toBe('t = 7');
    expect(formatTimecode(duration, duration, 'tick')).toBe('t = 23');
  });

  it('prints steps counted from 1, clamped to the last step at the end', () => {
    const duration = 23 * STEP_MS;
    expect(formatTimecode(0, duration, 'step')).toBe('step 1 / 23');
    expect(formatTimecode(6 * STEP_MS, duration, 'step')).toBe('step 7 / 23');
    expect(formatTimecode(duration, duration, 'step')).toBe('step 23 / 23');
  });

  it('absorbs float error from the scrubber', () => {
    expect(formatTimecode(7 * TICK_MS - 1e-7, 10 * TICK_MS, 'tick')).toBe('t = 7');
  });

  it('never prints a negative or non-finite position', () => {
    expect(formatTimecode(-40, 5 * TICK_MS, 'tick')).toBe('t = 0');
    expect(formatTimecode(Number.NaN, 5 * STEP_MS, 'step')).toBe('step 1 / 5');
    expect(formatTimecode(0, 0, 'step')).toBe('step 0 / 0');
  });
});

describe('formatDuration and formatTotal', () => {
  it('count units with the right plural', () => {
    expect(formatDuration(TICK_MS, 'tick')).toBe('1 tick');
    expect(formatDuration(3 * TICK_MS, 'tick')).toBe('3 ticks');
    expect(formatDuration(0, 'step')).toBe('0 steps');
    expect(formatTotal(23 * STEP_MS, 'step')).toBe('23 steps');
  });
});

describe('formatValueText', () => {
  it('reads as a sentence for the slider', () => {
    expect(formatValueText(7 * TICK_MS, 23 * TICK_MS, 'tick')).toBe('t = 7 of 23 ticks');
    expect(formatValueText(6 * STEP_MS, 23 * STEP_MS, 'step')).toBe('step 7 of 23');
  });
});

describe('unit arithmetic', () => {
  it('indexes, counts and snaps', () => {
    expect(unitIndex(2.5 * STEP_MS, 'step')).toBe(2);
    expect(unitCount(4 * TICK_MS, 'tick')).toBe(4);
    expect(snapToUnit(2.5 * TICK_MS, 'tick')).toBe(2 * TICK_MS);
  });
});

describe('percentOf', () => {
  it('maps a position onto the scrubber, clamped and safe on an empty run', () => {
    expect(percentOf(30, 120)).toBe(25);
    expect(percentOf(500, 120)).toBe(100);
    expect(percentOf(-10, 120)).toBe(0);
    expect(percentOf(10, 0)).toBe(0);
  });
});
