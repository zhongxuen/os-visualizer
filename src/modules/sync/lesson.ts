/**
 * The synchronisation walkthrough's examples and checkpoints, every answer read off a
 * core run (or the exhaustive exploration) of the example.
 */

import { matchExample } from '@/components/lesson/examples';
import type { CheckpointSpec } from '@/components/lesson/types';
import { lessonFor } from '@/content/lessons/catalog';
import { explore } from '@/core/sync/explore';
import { interleave } from '@/core/sync/interleave';
import { SYNC_PRESETS } from '@/core/sync/presets';
import { formatOp, threadName } from '@/core/sync/program';
import type { SyncInput } from '@/core/sync/state';

import { explorationSummary } from './adapters';

export const LESSON = lessonFor('sync');

export interface SyncExample {
  id: string;
  title: string;
  input: SyncInput;
}

const EXAMPLE_IDS = [
  'counter-race',
  'counter-mutex',
  'forgotten-unlock',
  'lock-order',
  'prodcons-1',
  'prodcons-broken',
];

export const LESSON_EXAMPLES: readonly SyncExample[] = EXAMPLE_IDS.map((id) => {
  const preset = SYNC_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Missing sync preset ${id}`);
  return {
    id,
    title: preset.title,
    input: { preset: id, program: preset.program, schedule: preset.schedule },
  };
});

/** The example the input is, ignoring the preset label. */
export function activeExample(input: SyncInput): string | null {
  return matchExample(
    LESSON_EXAMPLES.map((e) => ({
      id: e.id,
      input: [e.input.program, e.input.schedule],
    })),
    [input.program, input.schedule],
  );
}

function inputOf(example: string): SyncInput {
  return LESSON_EXAMPLES.find((e) => e.id === example)!.input;
}

function runOf(example: string) {
  const { program, schedule } = inputOf(example);
  return { program, run: interleave(program, schedule) };
}

/** "What will x be after this store?", held on the tick before the lost update. */
export function lostStoreCheckpoint(id: string, example: string): CheckpointSpec {
  const { program, run } = runOf(example);
  const store = run.events.find((e) => e.kind === 'sync.store' && e.lost);
  if (!store || store.thread === undefined || store.op === undefined) {
    throw new Error(`${example} loses no update`);
  }
  const op = program.threads[store.thread]!.ops[store.op]!;
  if (op.op !== 'store') throw new Error('not a store');
  const answer = store.state.vars[op.var]!;
  const values = [...new Set([answer - 1, answer, answer + 1].filter((v) => v >= 0))];
  return {
    id,
    example,
    question: `${threadName(store.thread)} runs ${formatOp(op)} next. What will ${op.var} be after it?`,
    options: values
      .sort((a, b) => a - b)
      .map((v) => ({ value: String(v), label: String(v) })),
    answer: String(answer),
    reason: store.label,
    holdAt: store.tick - 1,
  };
}

/** "How many interleavings are correct?", from the exhaustive exploration. */
export function shareCorrectCheckpoint(id: string, example: string): CheckpointSpec {
  const { program } = inputOf(example);
  const exploration = explore(program);
  if (exploration.tooLarge) throw new Error(`${example} is too large to explore`);
  const correct = exploration.groups
    .filter((g) => g.correct)
    .reduce((sum, g) => sum + g.count, 0);
  const share = correct / exploration.total;
  const answer =
    share === 1 ? 'all' : share === 0 ? 'none' : share < 0.5 ? 'few' : 'most';
  return {
    id,
    example,
    question: `Of every possible interleaving of these ${program.threads.reduce(
      (n, t) => n + t.ops.length,
      0,
    )} ops, how many end with the right answer?`,
    options: [
      { value: 'all', label: 'All of them' },
      { value: 'most', label: 'Most of them' },
      { value: 'few', label: 'Fewer than half' },
      { value: 'none', label: 'None' },
    ],
    answer,
    reason: explorationSummary(exploration),
    holdAt: 0,
  };
}

/** "What happens on this thread's next tick?", held just before the first event of `kind`. */
export function nextTickCheckpoint(
  id: string,
  example: string,
  kind: 'sync.spin' | 'sync.block',
): CheckpointSpec {
  const { program, run } = runOf(example);
  const event = run.events.find((e) => e.kind === kind);
  if (!event || event.thread === undefined || event.op === undefined) {
    throw new Error(`${example} has no ${kind}`);
  }
  const op = program.threads[event.thread]!.ops[event.op]!;
  const name = threadName(event.thread);
  const options =
    op.op === 'lock'
      ? [
          { value: 'proceed', label: `${name} takes ${op.m} anyway` },
          { value: 'spin', label: `${name} spins: it tries again on its next tick` },
          { value: 'sleep', label: `${name} sleeps until ${op.m} is free` },
        ]
      : [
          { value: 'proceed', label: `${name} passes the wait` },
          { value: 'spin', label: `${name} spins until the value is above 0` },
          { value: 'sleep', label: `${name} sleeps in the semaphore’s queue` },
        ];
  return {
    id,
    example,
    question: `${name}’s next op is ${formatOp(op)}. What happens when it runs?`,
    options,
    answer:
      event.kind === 'sync.spin'
        ? 'spin'
        : event.kind === 'sync.block'
          ? 'sleep'
          : 'proceed',
    reason: event.label,
    holdAt: event.tick - 1,
  };
}

export const LESSON_CHECKPOINTS: readonly CheckpointSpec[] = [
  lostStoreCheckpoint('race-store', 'counter-race'),
  shareCorrectCheckpoint('race-count', 'counter-race'),
  nextTickCheckpoint('mutex-spin', 'counter-mutex', 'sync.spin'),
  nextTickCheckpoint('prodcons-sleep', 'prodcons-1', 'sync.block'),
];
