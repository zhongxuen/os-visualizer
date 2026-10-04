import type { Scenario } from '../scenarios';
import { runRequest, runSafety } from './bankers';
import { BANKERS_PRESETS, GRAPH_PRESETS, graphPresetById } from './presets';
import { runGraph } from './recover';
import { runInput } from './run';
import { DEFAULT_INPUT } from './state';

/**
 * Every deadlock preset, for the determinism and citation tests: each graph preset with
 * both methods, deadlocked ones again with recovery, and each Banker's preset (plus a
 * safety run on every request preset's state). Keep the export name;
 * `src/core/scenarios.ts` imports it.
 */
export const deadlockScenarios: Scenario[] = [
  ...GRAPH_PRESETS.flatMap((preset) => {
    const other = preset.method === 'cycle' ? 'detect' : 'cycle';
    return [
      {
        id: `deadlock.${preset.id}`,
        title: preset.title,
        run: () => runGraph(preset.graph, preset.method),
      },
      {
        id: `deadlock.${preset.id}.${other}`,
        title: `${preset.title}, ${other}`,
        run: () => runGraph(preset.graph, other),
      },
    ];
  }),
  {
    id: 'deadlock.two-locks.terminate',
    title: 'Two locks, terminate T1',
    run: () =>
      runGraph(graphPresetById('two-locks')!.graph, 'cycle', [
        { kind: 'terminate', t: 1 },
      ]),
  },
  {
    id: 'deadlock.two-locks.preempt',
    title: 'Two locks, preempt R0 from T0',
    run: () =>
      runGraph(graphPresetById('two-locks')!.graph, 'cycle', [
        { kind: 'preempt', t: 0, r: 0 },
      ]),
  },
  {
    id: 'deadlock.osc10-detect-after.recover',
    title: 'OSC10 detection after T2’s request, terminate T1 then preempt',
    run: () =>
      runGraph(graphPresetById('osc10-detect-after')!.graph, 'detect', [
        { kind: 'terminate', t: 1 },
        { kind: 'preempt', t: 2, r: 2 },
      ]),
  },
  ...BANKERS_PRESETS.flatMap((preset) => [
    {
      id: `deadlock.bankers.${preset.id}`,
      title: preset.title,
      run: () =>
        runInput({
          ...DEFAULT_INPUT,
          view: 'bankers',
          bankers: preset.state,
          query: preset.query,
        }),
    },
    ...(preset.query.run === 'request'
      ? [
          {
            id: `deadlock.bankers.${preset.id}.safety`,
            title: `${preset.title}, safety only`,
            run: () => runSafety(preset.state),
          },
        ]
      : []),
  ]),
  {
    id: 'deadlock.bankers.osc10-t1.direct',
    title: 'OSC10 T1 request, run directly',
    run: () => runRequest(BANKERS_PRESETS[0]!.state, { t: 1, request: [1, 0, 2] }),
  },
];
