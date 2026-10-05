/**
 * The motion tokens of docs/UIUX.md §6.2, for code that has to compute with them.
 *
 * `src/styles/tokens.css` holds the same three durations as `--dur-1/2/3`;
 * `tokens.test.ts` (shell) keeps the two equal.
 */

import { PLAYBACK_SPEEDS } from '@/core/sim/playback';

export const DURATION = {
  /** `--dur-1`: highlights, chip state, colour changes. */
  highlight: 120,
  /** `--dur-2`: movement, a chip changing queue, a bar extending one tick. */
  move: 220,
  /** `--dur-3`: arrivals and exits, a page loading into a frame, a phase change. */
  enter: 360,
} as const;

/** `--ease-out` as a cubic-bezier tuple, for `motion`. */
export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

/**
 * §6.1 rule 3: an animation takes at most this share of the real time between steps,
 * so it always finishes before the next step starts.
 */
export const STEP_FIT = 0.6;

/**
 * The slowest speed at which animations collapse to instant: the 4th rung of the
 * `PLAYBACK_SPEEDS` ladder (2x, key `4`), and everything faster (4x, key `5`).
 */
export const INSTANT_FROM_SPEED: number = PLAYBACK_SPEEDS[3];
