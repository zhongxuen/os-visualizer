import type { Scenario } from '../scenarios';

/**
 * Every address translation preset, for the determinism and citation tests. Filled in by the vm
 * core. Keep the export name; `src/core/scenarios.ts` imports it.
 */
export const vmScenarios: Scenario[] = [];
