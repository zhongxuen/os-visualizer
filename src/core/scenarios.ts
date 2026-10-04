/**
 * The scenario catalogue: every preset in the product, as a runnable scenario.
 *
 * `tests/determinism.test.ts` runs each one twice and through JSON, and
 * `tests/citations.test.ts` checks every event's citation. A preset missing from here is
 * untested, so every preset must be in it.
 *
 * Append-only. A new module adds one import and one spread; nothing else here changes.
 */

import { deadlockScenarios } from './deadlock/scenarios';
import type { OsRun } from './events/types';
import { replaceScenarios } from './replace/scenarios';
import { schedScenarios } from './sched/scenarios';
import { syncScenarios } from './sync/scenarios';
import { vmScenarios } from './vm/scenarios';

export interface Scenario {
  /** Unique across the catalogue, e.g. `'sched.rr-q2-textbook'`. */
  id: string;
  title: string;
  run: () => OsRun;
}

export const scenarios: readonly Scenario[] = [
  ...schedScenarios,
  ...vmScenarios,
  ...replaceScenarios,
  ...deadlockScenarios,
  ...syncScenarios,
];
