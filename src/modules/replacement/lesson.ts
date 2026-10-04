/**
 * The page-replacement walkthrough's examples and checkpoints, every answer read off a
 * core run of the example.
 */

import { matchExample } from '@/components/lesson/examples';
import type { CheckpointSpec } from '@/components/lesson/types';
import { lessonFor } from '@/content/lessons/catalog';
import { POLICY_NAMES, type Policy, type ReplInput } from '@/core/replace/input';
import { REPL_PRESETS } from '@/core/replace/presets';
import { runReplace } from '@/core/replace/replace';

export const LESSON = lessonFor('replacement');

export interface ReplExample {
  id: string;
  title: string;
  input: ReplInput;
}

function fromPreset(presetId: string, policy: Policy): ReplExample {
  const preset = REPL_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`Missing replacement preset ${presetId}`);
  const input = { ...preset.input, policy };
  return {
    id: `${presetId}-${policy}`,
    title: `${preset.title}, ${POLICY_NAMES[policy]}, ${input.frames} frames`,
    input,
  };
}

export const LESSON_EXAMPLES: readonly ReplExample[] = [
  fromPreset('ostep', 'fifo'),
  fromPreset('ostep', 'opt'),
  fromPreset('ostep', 'lru'),
  fromPreset('clock', 'clock'),
  fromPreset('belady', 'fifo'),
];

export function activeExample(input: ReplInput): string | null {
  return matchExample(LESSON_EXAMPLES, input);
}

function runOf(example: string) {
  const { input } = LESSON_EXAMPLES.find((e) => e.id === example)!;
  return runReplace(input);
}

/** "Which page is evicted?", held on the fault, with the resident pages as options. */
export function victimCheckpoint(
  id: string,
  example: string,
  reference: number,
): CheckpointSpec {
  const run = runOf(example);
  const fault = run.events.findIndex(
    (e) => e.kind === 'repl.fault' && e.state.index === reference,
  );
  const victim = run.events.find(
    (e) => e.kind === 'repl.victim' && e.state.index === reference,
  );
  if (fault < 0 || !victim) throw new Error(`Reference ${reference} evicts nothing`);
  const { input } = LESSON_EXAMPLES.find((e) => e.id === example)!;
  const resident = run.events[fault]!.state.frames.filter((p): p is number => p !== null);
  return {
    id,
    example,
    question: `Page ${run.events[fault]!.page} faults. Which page does ${POLICY_NAMES[input.policy]} evict?`,
    options: [...resident]
      .sort((a, b) => a - b)
      .map((p) => ({ value: String(p), label: `Page ${p}` })),
    answer: String(victim.page),
    reason: victim.label,
    holdAt: fault,
  };
}

/** "Is the next reference a hit?", held on the last event of the reference before. */
export function hitCheckpoint(id: string, example: string, reference: number): CheckpointSpec {
  const run = runOf(example);
  const first = run.events.findIndex((e) => e.state.index === reference);
  if (first < 1) throw new Error(`Reference ${reference} needs one before it`);
  const decided = run.events[first]!;
  const { input } = LESSON_EXAMPLES.find((e) => e.id === example)!;
  return {
    id,
    example,
    question: `The next reference is page ${input.refString[reference]}. Hit or fault?`,
    options: [
      { value: 'hit', label: 'Hit' },
      { value: 'fault', label: 'Fault' },
    ],
    answer: decided.kind === 'repl.hit' ? 'hit' : 'fault',
    reason: decided.label,
    holdAt: first - 1,
  };
}

export const LESSON_CHECKPOINTS: readonly CheckpointSpec[] = [
  victimCheckpoint('fifo-evict', 'ostep-fifo', 5),
  victimCheckpoint('opt-evict', 'ostep-opt', 5),
  hitCheckpoint('lru-hit', 'ostep-lru', 6),
  victimCheckpoint('clock-evict', 'clock-clock', 5),
];
