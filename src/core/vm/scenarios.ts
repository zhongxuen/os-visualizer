import type { Scenario } from '../scenarios';
import { VM_PRESETS } from './presets';
import { runVm } from './translate';

/**
 * Every address translation preset, for the determinism and citation tests. Keep the
 * export name; `src/core/scenarios.ts` imports it.
 */
export const vmScenarios: Scenario[] = VM_PRESETS.map((preset) => ({
  id: `vm.${preset.id}`,
  title: preset.title,
  run: () => runVm(preset.input),
}));
