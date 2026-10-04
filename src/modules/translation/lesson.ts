/**
 * The translation walkthrough's examples and checkpoints, every answer read off a core
 * run of the example.
 */

import { canonicalJson } from '@/components/lesson/examples';
import type { CheckpointSpec } from '@/components/lesson/types';
import { lessonFor } from '@/content/lessons/catalog';
import { geometry, type VmInput } from '@/core/vm/config';
import type { VmEvent } from '@/core/vm/events';
import { VM_PRESETS, type VmPreset } from '@/core/vm/presets';
import { runVm, type VmRun } from '@/core/vm/translate';

export const LESSON = lessonFor('translation');

const EXAMPLE_IDS = ['ostep-paging', 'ostep-array', 'ostep-array-twice', 'two-level'];

export const LESSON_EXAMPLES: readonly VmPreset[] = EXAMPLE_IDS.map((id) => {
  const preset = VM_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Missing translation preset ${id}`);
  return preset;
});

function runInputOf(input: VmInput): VmInput {
  return {
    config: input.config,
    pages: input.pages,
    directory: input.directory,
    accesses: input.accesses,
  };
}

/** The example the input is, comparing only what the run depends on. */
export function activeExample(input: VmInput): string | null {
  const key = canonicalJson(runInputOf(input));
  return LESSON_EXAMPLES.find((e) => canonicalJson(runInputOf(e.input)) === key)?.id ?? null;
}

function runOf(example: string): { run: VmRun; preset: VmPreset } {
  const preset = LESSON_EXAMPLES.find((e) => e.id === example)!;
  return { run: runVm(preset.input), preset };
}

/** The step index of access `access`'s first event (its split), and its events. */
function accessEvents(run: VmRun, access: number): { start: number; events: VmEvent[] } {
  const start = run.events.findIndex((e) => e.access === access);
  if (start < 0) throw new Error(`No access ${access}`);
  return { start, events: run.events.filter((e) => e.access === access) };
}

/** "Will the TLB hit or miss?", held on the access's split. */
export function tlbCheckpoint(id: string, example: string, access: number): CheckpointSpec {
  const { run, preset } = runOf(example);
  const { start, events } = accessEvents(run, access);
  const lookup = events.find((e) => e.kind === 'vm.tlbHit' || e.kind === 'vm.tlbMiss')!;
  const va = preset.input.accesses[access]!.va;
  return {
    id,
    example,
    question: `Access ${access + 1} reads VA ${va}. Will the TLB hit or miss?`,
    options: [
      { value: 'hit', label: 'Hit' },
      { value: 'miss', label: 'Miss' },
    ],
    answer: lookup.kind === 'vm.tlbHit' ? 'hit' : 'miss',
    reason: lookup.label,
    holdAt: start,
  };
}

/** "Which physical address?", with the untranslated address and near misses as options. */
export function paCheckpoint(id: string, example: string, access: number): CheckpointSpec {
  const { run, preset } = runOf(example);
  const { start, events } = accessEvents(run, access);
  const physical = events.find((e) => e.kind === 'vm.physical');
  if (!physical || physical.pa === undefined) throw new Error('The access must complete');
  const { pageSize } = geometry(preset.input.config);
  const va = physical.va;
  const pa = physical.pa;
  const candidates = [pa, va, pa - (va % pageSize), pa + pageSize];
  const options = [...new Set(candidates)]
    .sort((a, b) => a - b)
    .map((n) => ({ value: String(n), label: `PA ${n}` }));
  return {
    id,
    example,
    question: `VA ${va}: which physical address does it become?`,
    options,
    answer: String(pa),
    reason: physical.label,
    holdAt: start,
  };
}

/** "How many memory references will this access make?" */
export function refsCheckpoint(id: string, example: string, access: number): CheckpointSpec {
  const { run } = runOf(example);
  const { start, events } = accessEvents(run, access);
  const last = events[events.length - 1]!;
  const result = last.state.log.find((r) => r.index === access)!;
  const levels = runOf(example).preset.input.config.levels;
  const most = levels + 1;
  return {
    id,
    example,
    question: `VA ${result.va}: how many memory references will this access make, page-table reads included?`,
    options: Array.from({ length: most }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1),
    })),
    answer: String(result.memRefs),
    reason: last.label,
    holdAt: start,
  };
}

export const LESSON_CHECKPOINTS: readonly CheckpointSpec[] = [
  paCheckpoint('paging-pa', 'ostep-paging', 0),
  tlbCheckpoint('array-miss', 'ostep-array', 3),
  refsCheckpoint('two-level-refs', 'two-level', 0),
];
