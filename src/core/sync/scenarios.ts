import type { Scenario } from '../scenarios';
import { explore } from './explore';
import { interleave } from './interleave';
import { SYNC_PRESETS } from './presets';

/**
 * Every synchronisation preset, for the determinism and citation tests: its own
 * schedule, round robin with quanta 1 and 2, two seeded random runs, and the example
 * interleaving of every outcome group exploration finds. Keep the export name;
 * `src/core/scenarios.ts` imports it.
 */
export const syncScenarios: Scenario[] = SYNC_PRESETS.flatMap((preset) => {
  const { program } = preset;
  const exploration = explore(program);
  const groups = exploration.tooLarge ? [] : exploration.groups;
  return [
    {
      id: `sync.${preset.id}`,
      title: preset.title,
      run: () => interleave(program, preset.schedule),
    },
    ...[1, 2].map((quantum) => ({
      id: `sync.${preset.id}.rr${quantum}`,
      title: `${preset.title}, round robin q = ${quantum}`,
      run: () => interleave(program, { kind: 'rr', quantum }),
    })),
    ...[1, 42].map((seed) => ({
      id: `sync.${preset.id}.seed${seed}`,
      title: `${preset.title}, seed ${seed}`,
      run: () => interleave(program, { kind: 'random', seed }),
    })),
    ...groups.map((group, i) => ({
      id: `sync.${preset.id}.outcome${i}`,
      title: `${preset.title}: ${group.label}`,
      run: () => interleave(program, { kind: 'manual', picks: group.example }),
    })),
  ];
});
