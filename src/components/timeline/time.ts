/**
 * Printing virtual time, as ticks or steps.
 *
 * Vendored from Internet Visualizer and rewritten (see VENDORED.md): there, virtual time
 * is milliseconds of simulated network and is printed as such. Here the milliseconds are
 * only the playback kernel's clock (`TICK_MS` or `STEP_MS` per unit, see
 * `src/core/events/builder.ts`), and printing them would teach nothing. A scheduling run
 * is read in ticks ("t = 7"); a translation, replacement or deadlock run in steps
 * ("step 7 / 23").
 *
 * The numbers do not change with the speed control: t = 7 is t = 7 at 0.25x or 4x.
 */

import { UNIT_MS, type RunUnit } from '@/core/events/builder';

function safe(ms: number): number {
  return Number.isFinite(ms) ? Math.max(0, ms) : 0;
}

/** Whole units in `ms`, rounded down: the tick or step the playhead is inside. */
export function unitIndex(ms: number, unit: RunUnit): number {
  // The epsilon absorbs float error from the scrubber's fractional step size, so a
  // playhead at 6999.9999 reads as t = 7 rather than t = 6.
  return Math.floor(safe(ms) / UNIT_MS[unit] + 1e-9);
}

/** Number of ticks or steps in a run of `durationMs`. */
export function unitCount(durationMs: number, unit: RunUnit): number {
  return Math.round(safe(durationMs) / UNIT_MS[unit]);
}

/** The playhead snapped to the start of the unit it is in. For reduced motion. */
export function snapToUnit(ms: number, unit: RunUnit): number {
  return unitIndex(ms, unit) * UNIT_MS[unit];
}

/**
 * A position on the timeline.
 *
 * - Ticks: `t = 7`. Time is a point; the end of a 23-tick run is `t = 23`.
 * - Steps: `step 7 / 23`, counting from 1. Steps are things that happen, so the
 *   playhead is always *on* one; the end of the run is the last step.
 */
export function formatTimecode(ms: number, durationMs: number, unit: RunUnit): string {
  if (unit === 'tick') return `t = ${unitIndex(ms, unit)}`;
  const count = unitCount(durationMs, unit);
  const current = Math.min(count, unitIndex(ms, unit) + 1);
  return `step ${Math.max(count === 0 ? 0 : 1, current)} / ${count}`;
}

/** The far end of the timeline, as printed under it: `23 ticks` or `23 steps`. */
export function formatTotal(durationMs: number, unit: RunUnit): string {
  return formatDuration(durationMs, unit);
}

/** A length of time on its own -- a phase's extent: `3 ticks`, `1 step`. */
export function formatDuration(ms: number, unit: RunUnit): string {
  const count = unitCount(ms, unit);
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

/** The scrubber's accessible value: `t = 7 of 23 ticks`, `step 7 of 23`. */
export function formatValueText(ms: number, durationMs: number, unit: RunUnit): string {
  if (unit === 'tick') {
    return `${formatTimecode(ms, durationMs, unit)} of ${formatTotal(durationMs, unit)}`;
  }
  return formatTimecode(ms, durationMs, unit).replace(' / ', ' of ');
}

/** `0`..`100`, for a CSS percentage. Safe on a zero-length run. */
export function percentOf(ms: number, durationMs: number): number {
  if (!(durationMs > 0) || !Number.isFinite(ms)) return 0;
  return Math.min(100, Math.max(0, (ms / durationMs) * 100));
}
