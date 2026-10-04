import type { Scenario } from '../scenarios';
import { POLICIES } from './input';
import { REPL_PRESETS } from './presets';
import { replace, runReplace } from './replace';

/**
 * Every page replacement preset, for the determinism and citation tests: each preset as
 * it loads, plus each preset's string under every policy and with one frame more (the
 * runs the Belady panel and the policy tabs show). Keep the export name;
 * `src/core/scenarios.ts` imports it.
 */
export const replaceScenarios: Scenario[] = REPL_PRESETS.flatMap((preset) => [
  {
    id: `replace.${preset.id}`,
    title: preset.title,
    run: () => runReplace(preset.input),
  },
  ...POLICIES.filter((policy) => policy !== preset.input.policy).map((policy) => ({
    id: `replace.${preset.id}.${policy}`,
    title: `${preset.title}, ${policy}`,
    run: () => replace(preset.input.refString, preset.input.frames, policy),
  })),
  {
    id: `replace.${preset.id}.plus1`,
    title: `${preset.title}, one frame more`,
    run: () =>
      replace(preset.input.refString, preset.input.frames + 1, preset.input.policy),
  },
]);
