import type { Scenario } from '../scenarios';
import { COMPARE_PRESETS } from './compare';
import { SCHED_PRESETS } from './presets';
import { schedule } from './schedule';

/**
 * Every CPU scheduling preset, for the determinism and citation tests: each scheduling
 * preset, and each policy column of each Compare preset. Keep the export name;
 * `src/core/scenarios.ts` imports it.
 */
export const schedScenarios: Scenario[] = [
  ...SCHED_PRESETS.map((preset) => ({
    id: `sched.${preset.id}`,
    title: preset.title,
    run: () => schedule(preset.workload, preset.policy),
  })),
  ...COMPARE_PRESETS.flatMap((preset) =>
    preset.policies.map((policy, i) => ({
      id: `sched.compare.${preset.id}.${i}`,
      title: `${preset.title}, column ${i + 1}`,
      run: () => schedule(preset.workload, policy),
    })),
  ),
];
