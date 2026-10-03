/**
 * A tiny hand-written run for the vendored playback test.
 *
 * `__tests__/playback.test.ts` is vendored unchanged from Internet Visualizer and imports
 * `buildToyRun` from `../toyRun`. Internet Visualizer's toy run is a ping with PDUs and a
 * topology, none of which exist here, so this file reproduces only what the test reads:
 * phases starting at 0, 10 and 60, events at
 * `[0, 8, 10, 16, 24, 54, 60, 90, 96, 102]` (some sharing an instant), and a duration of
 * 120. See VENDORED.md.
 */

import { summarizePhases, type PhaseStart, type SimResult } from './result';

const DURATION_MS = 120;

const PHASES: readonly PhaseStart[] = [
  { at: 0, id: 'compose', title: 'Compose', description: 'First phase.' },
  { at: 10, id: 'request', title: 'Request', description: 'Second phase.' },
  { at: 60, id: 'reply', title: 'Reply', description: 'Third phase.' },
];

const EVENT_TIMES = [0, 0, 8, 10, 16, 16, 24, 54, 54, 60, 60, 90, 96, 102, 102];

export function buildToyRun(): SimResult {
  return {
    events: EVENT_TIMES.map((at) => ({ at })),
    phases: summarizePhases(PHASES, DURATION_MS),
    durationMs: DURATION_MS,
  };
}
