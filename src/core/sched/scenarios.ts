import type { Scenario } from '../scenarios';

/**
 * Every CPU scheduling preset, for the determinism and citation tests. Filled in by the sched
 * core. Keep the export name; `src/core/scenarios.ts` imports it.
 */
export const schedScenarios: Scenario[] = [];
