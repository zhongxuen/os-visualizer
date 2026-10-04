/**
 * The compare walkthrough's examples and checkpoints. Each question is about a whole
 * run, so the timeline holds at t = 0 until it is answered: predict, then play.
 */

import { formatMetric } from '@/components/blocks/MetricsTable';
import { matchExample } from '@/components/lesson/examples';
import type { CheckpointSpec } from '@/components/lesson/types';
import { lessonFor } from '@/content/lessons/catalog';
import {
  bestIndexes,
  compare,
  COMPARE_PRESETS,
  type CompareRowId,
} from '@/core/sched/compare';
import type { Policy, Workload } from '@/core/sched/workload';

export const LESSON = lessonFor('compare');

export interface CompareExample {
  id: string;
  title: string;
  input: { workload: Workload; policies: Policy[] };
}

const EXAMPLE_IDS = ['response-vs-turnaround', 'rr-sweep', 'fcfs-sjf-srtf'];

export const LESSON_EXAMPLES: readonly CompareExample[] = EXAMPLE_IDS.map((id) => {
  const preset = COMPARE_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Missing compare preset ${id}`);
  return {
    id,
    title: preset.title,
    input: { workload: preset.workload, policies: preset.policies },
  };
});

export function activeExample(input: CompareExample['input']): string | null {
  return matchExample(LESSON_EXAMPLES, input);
}

/** "Which policy has the best … over the whole run?" */
export function bestCheckpoint(
  id: string,
  example: string,
  row: CompareRowId,
): CheckpointSpec {
  const { input } = LESSON_EXAMPLES.find((e) => e.id === example)!;
  const result = compare(input.workload, input.policies);
  const metric = result.table.find((r) => r.id === row)!;
  const best = bestIndexes(metric);
  if (best.length !== 1) throw new Error(`${example}: ${row} has no single best`);
  const values = result.names
    .map((name, i) => `${name} ${formatMetric(metric.values[i]!)}`)
    .join(', ');
  return {
    id,
    example,
    question: `Over the whole run, which column has the ${metric.better === 'lower' ? 'lowest' : 'highest'} ${metric.phrase}?`,
    options: result.names.map((name, i) => ({ value: String(i), label: name })),
    answer: String(best[0]),
    reason: `${metric.label}: ${values}. ${metric.better === 'lower' ? 'Lower' : 'Higher'} is better.`,
    holdAt: 0,
  };
}

export const LESSON_CHECKPOINTS: readonly CheckpointSpec[] = [
  bestCheckpoint('response', 'response-vs-turnaround', 'response'),
  bestCheckpoint('turnaround', 'response-vs-turnaround', 'turnaround'),
  bestCheckpoint('switches', 'rr-sweep', 'contextSwitches'),
];
