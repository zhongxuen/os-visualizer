/**
 * Faults against frame count: the curve that shows the difference between the stack
 * algorithms (LRU, OPT: faults never rise with more frames) and FIFO, which can fault
 * *more* with more frames (Belady's anomaly; OSC10 §10.4.2, OSTEP §22.6).
 */

import { LIMITS, POLICIES, type Policy } from './input';
import { countFaults } from './replace';

/** Frame counts the curve covers: 1..8. */
export const CURVE_FRAMES: readonly number[] = Array.from(
  { length: LIMITS.maxFrames - LIMITS.minFrames + 1 },
  (_, i) => LIMITS.minFrames + i,
);

/** Faults for 1..`maxFrames` frames; entry `i` is for `i + 1` frames. */
export function faultsByFrames(
  refString: readonly number[],
  policy: Policy,
  maxFrames: number = LIMITS.maxFrames,
): number[] {
  return Array.from(
    { length: maxFrames },
    (_, i) => countFaults(refString, i + 1, policy).faults,
  );
}

/** Every policy's curve. */
export function allCurves(refString: readonly number[]): Record<Policy, number[]> {
  return Object.fromEntries(
    POLICIES.map((policy) => [policy, faultsByFrames(refString, policy)]),
  ) as Record<Policy, number[]>;
}

export interface Anomaly {
  /** The larger frame count, which faults more. */
  frames: number;
  faults: number;
  /** Faults with one frame fewer. */
  previous: number;
}

/**
 * Every point where one more frame gives more faults. `curve[i]` is for `i + 1` frames,
 * as `faultsByFrames` returns it.
 */
export function beladyPoints(curve: readonly number[]): Anomaly[] {
  const points: Anomaly[] = [];
  for (let i = 1; i < curve.length; i += 1) {
    if (curve[i]! > curve[i - 1]!) {
      points.push({ frames: i + 1, faults: curve[i]!, previous: curve[i - 1]! });
    }
  }
  return points;
}
