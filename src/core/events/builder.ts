/**
 * The run builder: how every algorithm core turns its decisions into a `SimResult`.
 *
 * Two kinds of run share one builder:
 *
 * - **Tick runs** (scheduling, synchronisation): one tick is `TICK_MS` virtual ms, so 1x
 *   speed plays one tick per second.
 * - **Step runs** (translation, replacement, deadlock): step *n* starts at
 *   `n * STEP_MS`.
 *
 * The builder holds an integer position. `emit` stamps the event with the position's
 * time, so events are sorted by construction and several may share one tick. `phase`
 * starts a new phase at the current position. `advance` moves forward; there is no way
 * back.
 */

import {
  summarizePhases,
  type PhaseStart,
  type SimResult,
  type TimedEvent,
} from '../sim/result';

export const TICK_MS = 1000;
export const STEP_MS = 800;

export type RunUnit = 'tick' | 'step';

export const UNIT_MS: Record<RunUnit, number> = { tick: TICK_MS, step: STEP_MS };

/** `Omit` that distributes over a union, so each variant keeps its own fields. */
export type WithoutAt<E> = E extends TimedEvent ? Omit<E, 'at'> : never;

export interface RunOptions {
  unit: RunUnit;
}

export interface RunBuilder<E extends TimedEvent & { id: string }> {
  readonly unit: RunUnit;
  /** Current tick or step index, starting at 0. */
  readonly position: number;
  /** Current position in virtual ms. */
  readonly at: number;
  /** Record an event at the current position. Event ids must be unique in the run. */
  emit(event: WithoutAt<E>): E;
  /** Start a new phase at the current position. Phase ids must be unique in the run. */
  phase(id: string, title: string, description: string, plain?: string): void;
  /** Move forward `n` ticks or steps (a non-negative integer, default 1). */
  advance(n?: number): void;
  /**
   * The finished run. `durationMs` is the current position, so advance past the last
   * tick or step first if it should have width on the timeline.
   */
  finish(): SimResult<E>;
}

export function createRun<E extends TimedEvent & { id: string }>(
  options: RunOptions,
): RunBuilder<E> {
  const { unit } = options;
  const unitMs = UNIT_MS[unit];
  if (unitMs === undefined) throw new RangeError(`Unknown run unit: ${String(unit)}`);

  let position = 0;
  const events: E[] = [];
  const eventIds = new Set<string>();
  const phases: PhaseStart[] = [];
  const phaseIds = new Set<string>();

  return {
    unit,
    get position() {
      return position;
    },
    get at() {
      return position * unitMs;
    },
    emit(event) {
      if (eventIds.has(event.id)) throw new Error(`Duplicate event id: ${event.id}`);
      eventIds.add(event.id);
      const stamped = { ...event, at: position * unitMs } as unknown as E;
      events.push(stamped);
      return stamped;
    },
    phase(id, title, description, plain) {
      if (phaseIds.has(id)) throw new Error(`Duplicate phase id: ${id}`);
      phaseIds.add(id);
      phases.push({
        at: position * unitMs,
        id,
        title,
        description,
        ...(plain === undefined ? {} : { plain }),
      });
    },
    advance(n = 1) {
      if (!Number.isInteger(n) || n < 0) {
        throw new RangeError(`advance() takes a non-negative integer, got ${n}`);
      }
      position += n;
    },
    finish() {
      const durationMs = position * unitMs;
      return {
        events: [...events],
        phases: summarizePhases(phases, durationMs),
        durationMs,
      };
    },
  };
}
