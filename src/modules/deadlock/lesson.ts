/**
 * The deadlock walkthrough's examples and checkpoints, every answer read off a core run
 * of the example.
 */

import { canonicalJson } from '@/components/lesson/examples';
import type { CheckpointSpec } from '@/components/lesson/types';
import { lessonFor } from '@/content/lessons/catalog';
import type { DlResult } from '@/core/deadlock/events';
import { BANKERS_PRESETS, GRAPH_PRESETS } from '@/core/deadlock/presets';
import { runInput } from '@/core/deadlock/run';
import { DEFAULT_INPUT, type DlInput } from '@/core/deadlock/state';

import { finalResult } from './adapters';

export const LESSON = lessonFor('deadlock');

export interface DlExample {
  id: string;
  title: string;
  /** The part of the input the example sets; the rest is left as it is. */
  patch: Partial<DlInput>;
}

function graphExample(presetId: string, recovery: DlInput['recovery'] = []): DlExample {
  const preset = GRAPH_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`Missing graph preset ${presetId}`);
  return {
    id: recovery.length ? `${presetId}-recovered` : presetId,
    title: recovery.length ? `${preset.title}, then recovery` : preset.title,
    patch: { view: 'graph', graph: preset.graph, method: preset.method, recovery },
  };
}

function bankersExample(presetId: string): DlExample {
  const preset = BANKERS_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`Missing Banker’s preset ${presetId}`);
  return {
    id: `bankers-${presetId}`,
    title: preset.title,
    patch: { view: 'bankers', bankers: preset.state, query: preset.query },
  };
}

export const LESSON_EXAMPLES: readonly DlExample[] = [
  graphExample('two-locks'),
  graphExample('cycle-no-deadlock'),
  graphExample('osc10-detect-after'),
  bankersExample('osc10-safe'),
  bankersExample('osc10-t0'),
  graphExample('two-locks', [{ kind: 'terminate', t: 1 }]),
];

/** What a tab's run depends on, so an example counts as loaded whatever the other tab holds. */
function relevant(input: DlInput): unknown {
  return input.view === 'graph'
    ? {
        view: input.view,
        graph: input.graph,
        method: input.method,
        recovery: input.recovery,
      }
    : { view: input.view, bankers: input.bankers, query: input.query };
}

export function activeExample(input: DlInput): string | null {
  const key = canonicalJson(relevant(input));
  return (
    LESSON_EXAMPLES.find(
      (e) => canonicalJson(relevant({ ...DEFAULT_INPUT, ...e.patch })) === key,
    )?.id ?? null
  );
}

function runOf(example: string) {
  const { patch } = LESSON_EXAMPLES.find((e) => e.id === example)!;
  return runInput({ ...DEFAULT_INPUT, ...patch });
}

const VERDICTS: Record<DlResult['kind'], string> = {
  cycle: 'deadlocked',
  deadlocked: 'deadlocked',
  acyclic: 'not-deadlocked',
  'not-deadlocked': 'not-deadlocked',
  safe: 'safe',
  unsafe: 'unsafe',
  granted: 'granted',
  refused: 'refused',
  wait: 'wait',
  error: 'error',
};

/** A yes/no-style question about how the run ends, held on its first step. */
function outcomeCheckpoint(
  id: string,
  example: string,
  question: string,
  options: { value: string; label: string }[],
): CheckpointSpec {
  const run = runOf(example);
  const result = finalResult(run);
  if (!result) throw new Error(`${example} decides nothing`);
  const answer = VERDICTS[result.kind];
  if (!options.some((o) => o.value === answer)) {
    throw new Error(`${example} ends ${answer}, which is not an option`);
  }
  return {
    id,
    example,
    question,
    options,
    answer,
    reason: run.events[run.events.length - 1]!.label,
    holdAt: 0,
  };
}

const DEADLOCK_OPTIONS = [
  { value: 'deadlocked', label: 'Deadlocked' },
  { value: 'not-deadlocked', label: 'Not deadlocked' },
];

export const LESSON_CHECKPOINTS: readonly CheckpointSpec[] = [
  outcomeCheckpoint(
    'two-locks',
    'two-locks',
    'Each thread holds one lock and waits for the other. Is this deadlocked?',
    DEADLOCK_OPTIONS,
  ),
  outcomeCheckpoint(
    'cycle-multi',
    'cycle-no-deadlock',
    'The graph has a cycle, and R0 and R1 have two instances each. Is it deadlocked?',
    DEADLOCK_OPTIONS,
  ),
  outcomeCheckpoint('bankers-safe', 'bankers-osc10-safe', 'Is this state safe?', [
    { value: 'safe', label: 'Safe' },
    { value: 'unsafe', label: 'Unsafe' },
  ]),
  outcomeCheckpoint(
    'bankers-t0',
    'bankers-osc10-t0',
    'T0 asks for (0, 2, 0), within its Need and within Available. What does Banker’s algorithm do?',
    [
      { value: 'granted', label: 'Grant it' },
      { value: 'refused', label: 'Refuse it: T0 waits' },
      { value: 'error', label: 'Report an error' },
    ],
  ),
];
