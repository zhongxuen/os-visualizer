'use client';

import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { DEFAULT_SPEED } from '@/core/sim/playback';

import { PlaybackContext } from '../timeline/hooks/usePlayback';
import { useReducedMotionSafe } from '../timeline/useReducedMotionSafe';

import { DURATION, INSTANT_FROM_SPEED, STEP_FIT } from './tokens';

/**
 * How the last step change should look (docs/UIUX.md §6.1). Every motion primitive asks
 * this one question, so the rules live in one place:
 *
 * - **Rule 2: forward steps animate; everything else is instant.** Exactly one step
 *   forward animates. A step back, a jump of several steps (scrubbing, Home/End, a phase
 *   jump) and the first render (loading a URL) go straight to the state.
 * - **Rule 3: animations fit inside the step.** Duration is
 *   `min(token, 0.6 x real step interval)`, and at speeds 4-5 (2x and 4x) it is `0`, so
 *   fast playback never queues animations behind the timeline.
 * - **Rule 5: reduced motion.** Read from `useReducedMotionSafe()` (B9): duration `0`.
 *
 * The answer is a pure function of (previous step, step, speed, interval, preference),
 * so the same step always lands in the same final frame.
 */

export type StepDirection = 'forward' | 'back' | 'none';

export interface StepTransition {
  from: number;
  to: number;
  direction: StepDirection;
  /** Play the change: one step forward, at a speed below 4-5, motion allowed. */
  animate: boolean;
  /** The duration (ms) for the default token (`--dur-2`), or `0`. */
  duration: number;
  /** The duration (ms) for any token under the same rules, or `0`. */
  scale: (tokenMs: number) => number;
}

export interface StepTransitionInput {
  from: number;
  to: number;
  /** Playback speed multiplier (`PLAYBACK_SPEEDS`). */
  speed: number;
  reduced: boolean;
  /**
   * Virtual milliseconds between one step and the next while playing. Leave it out when
   * steps are taken by hand: then nothing caps the duration but its token.
   */
  stepIntervalMs?: number;
}

/** The pure part: what the change from `from` to `to` should look like. */
export function stepTransition({
  from,
  to,
  speed,
  reduced,
  stepIntervalMs,
}: StepTransitionInput): StepTransition {
  const delta = to - from;
  const direction: StepDirection = delta > 0 ? 'forward' : delta < 0 ? 'back' : 'none';
  const moves = !reduced && delta === 1 && speed < INSTANT_FROM_SPEED;
  const realInterval =
    stepIntervalMs !== undefined && stepIntervalMs > 0 && speed > 0
      ? stepIntervalMs / speed
      : Infinity;
  const scale = (tokenMs: number) =>
    moves ? Math.round(Math.min(tokenMs, STEP_FIT * realInterval)) : 0;
  const duration = scale(DURATION.move);
  return { from, to, direction, animate: duration > 0, duration, scale };
}

const noSubscribe = () => () => {};
const noSpeed = () => undefined;

export interface StepChangeOptions {
  /** Overrides the speed read from the surrounding `PlaybackContext`. */
  speed?: number;
  /** See `StepTransitionInput.stepIntervalMs`. */
  stepIntervalMs?: number;
}

/**
 * Track `step` and report how it last changed. Speed comes from the surrounding
 * playback store when there is one (the "hook over usePlayback"), else `options.speed`,
 * else 1x.
 */
export function useStepChange(
  step: number,
  options: StepChangeOptions = {},
): StepTransition {
  const { reduced } = useReducedMotionSafe();
  const store = useContext(PlaybackContext);
  const storeSpeed = useSyncExternalStore(
    store ? store.subscribe : noSubscribe,
    store ? () => store.getState().speed : noSpeed,
    store ? () => store.getState().speed : noSpeed,
  );
  const speed = options.speed ?? storeSpeed ?? DEFAULT_SPEED;

  const [pair, setPair] = useState({ from: step, to: step });
  let current = pair;
  // Adjusting state while rendering (React's "storing information from previous renders").
  if (pair.to !== step) {
    current = { from: pair.to, to: step };
    setPair(current);
  }

  const { stepIntervalMs } = options;
  return useMemo(
    () =>
      stepTransition({
        from: current.from,
        to: current.to,
        speed,
        reduced,
        stepIntervalMs,
      }),
    [current.from, current.to, speed, reduced, stepIntervalMs],
  );
}

const StepContext = createContext<StepTransition>(
  stepTransition({ from: 0, to: 0, speed: DEFAULT_SPEED, reduced: true }),
);

export interface StepTransitionProviderProps extends StepChangeOptions {
  /** The current step index (tick, reference, access). */
  step: number;
  children?: ReactNode;
}

/** Gives every primitive under it the current step change. */
export function StepTransitionProvider({
  step,
  children,
  ...options
}: StepTransitionProviderProps) {
  const transition = useStepChange(step, options);
  return createElement(StepContext.Provider, { value: transition }, children);
}

/**
 * The step change from the nearest `StepTransitionProvider`: `{ animate, duration }`
 * plus `scale(token)`. Outside a provider, nothing animates.
 */
export function useStepTransition(): StepTransition {
  return useContext(StepContext);
}
