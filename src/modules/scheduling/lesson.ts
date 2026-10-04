/**
 * The scheduling walkthrough's examples and checkpoints. Every answer and every reason
 * is read off a core run of the example, never written by hand: change the scheduler and
 * the checkpoints follow it.
 */

import type { CheckpointSpec } from '@/components/lesson/types';
import { SCHED_PRESETS } from '@/core/sched/presets';
import { schedule, type SchedRun } from '@/core/sched/schedule';
import type { Policy, Workload } from '@/core/sched/workload';
import { lessonFor } from '@/content/lessons/catalog';

import { eventsAt, finalSegments, primaryEvent } from './adapters';

export const LESSON = lessonFor('scheduling');

export interface SchedExample {
  id: string;
  title: string;
  input: { workload: Workload; policy: Policy };
}

const EXAMPLE_IDS = [
  'convoy',
  'osc-srtf',
  'ostep-rr',
  'priority-starvation',
  'priority-aging',
  'mlfq-gaming-old',
  'mlfq-gaming-new',
] as const;

export const LESSON_EXAMPLES: readonly SchedExample[] = EXAMPLE_IDS.map((id) => {
  const preset = SCHED_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Missing scheduling preset ${id}`);
  return {
    id,
    title: preset.title,
    input: { workload: preset.workload, policy: preset.policy },
  };
});

function runOf(example: string): { run: SchedRun; workload: Workload } {
  const { input } = LESSON_EXAMPLES.find((e) => e.id === example)!;
  return { run: schedule(input.workload, input.policy), workload: input.workload };
}

/** Who holds the CPU during tick `t` (from `t` to `t + 1`), and the decision behind it. */
export function runsFrom(run: SchedRun, t: number): { pid: string; reason: string } {
  const segment = finalSegments(run).find((s) => s.start <= t && t < s.end);
  if (!segment) throw new Error(`Nothing runs at t = ${t}`);
  const reason = primaryEvent(eventsAt(run, t))?.label ?? `${segment.pid} keeps running`;
  return { pid: segment.pid, reason };
}

/** "Which process runs from t = …?", held one tick before, so the decision is unseen. */
export function whoRunsCheckpoint(
  id: string,
  example: string,
  t: number,
): CheckpointSpec {
  const { run, workload } = runOf(example);
  const { pid, reason } = runsFrom(run, t);
  return {
    id,
    example,
    question: `Which process runs from t = ${t}?`,
    options: workload.processes.map((p) => ({ value: p.pid, label: p.pid })),
    answer: pid,
    reason,
    holdAt: t - 1,
  };
}

export const LESSON_CHECKPOINTS: readonly CheckpointSpec[] = [
  whoRunsCheckpoint('convoy-16', 'convoy', 16),
  whoRunsCheckpoint('srtf-5', 'osc-srtf', 5),
  whoRunsCheckpoint('aging-9', 'priority-aging', 9),
  whoRunsCheckpoint('mlfq-old-8', 'mlfq-gaming-old', 8),
];
