/**
 * What Compare says about a comparison, as pure functions: which cell in each metric row
 * is best or tied (C2), the end-of-run sentence and "Try this next" preset (G16), and
 * the "same policy, other settings" variant the Add policy menu offers (C4).
 *
 * The marks use `bestIndexes` from the core, the same rounding the "Why?" headline uses,
 * so a starred cell and the headline can never disagree.
 */

import { formatMetric } from '@/components/blocks/MetricsTable';
import { matchExample } from '@/components/lesson/examples';
import {
  bestIndexes,
  COMPARE_PRESETS,
  type ComparePreset,
  type CompareRow,
  type CompareRowId,
} from '@/core/sched/compare';
import { LIMITS, type Policy, type Workload } from '@/core/sched/workload';

/** `best`: the only column with the best value. `tie`: one of several that share it. */
export type Mark = 'best' | 'tie' | null;

/** One mark per column. When every column holds the best value, every one is a tie. */
export function rowMarks(row: Pick<CompareRow, 'values' | 'better'>): Mark[] {
  const best = bestIndexes(row);
  return row.values.map((_, i) =>
    best.includes(i) ? (best.length === 1 ? 'best' : 'tie') : null,
  );
}

/** A row's unit, said after its label. */
export const ROW_UNITS: Record<CompareRowId, string | null> = {
  waiting: 'ticks',
  turnaround: 'ticks',
  response: 'ticks',
  utilisation: null,
  throughput: 'per tick',
  contextSwitches: null,
};

/** A value as the table shows it: utilisation as a percentage, the rest as numbers. */
export function formatValue(id: CompareRowId, value: number): string {
  return id === 'utilisation' ? `${formatMetric(value * 100)}%` : formatMetric(value);
}

type Input = { workload: Workload; policies: readonly Policy[] };

const PRESET_EXAMPLES = COMPARE_PRESETS.map((preset) => ({
  id: preset.id,
  input: { workload: preset.workload, policies: preset.policies },
}));

/** The preset this input is, exactly, or `null` for anything edited. */
export function presetFor(input: Input): string | null {
  return matchExample(PRESET_EXAMPLES, input);
}

/** Each preset's contrasting next run, and why. Every preset is reached from another. */
const TRY_NEXT: Record<string, { id: string; why: string }> = {
  'fcfs-sjf-srtf': {
    id: 'response-vs-turnaround',
    why: 'SJF won on turnaround here. See what it costs in response time against round robin.',
  },
  'response-vs-turnaround': {
    id: 'rr-sweep',
    why: 'Round robin answered first. Now see what a small quantum costs in context switches.',
  },
  'rr-sweep': {
    id: 'mlfq-vs-rr',
    why: 'A small quantum responds fast but switches often. MLFQ tries to get both.',
  },
  'mlfq-vs-rr': {
    id: 'fcfs-sjf-srtf',
    why: 'Back to the convoy: one long job first, and how SJF and SRTF let the short ones past.',
  },
};

const CUSTOM_NEXT = {
  id: 'rr-sweep',
  why: 'One workload, four quanta: see how a single setting moves every number.',
};

/** The "Try this next" preset for the run on screen (G16). */
export function tryNextFor(input: Input): { preset: ComparePreset; why: string } {
  const next = TRY_NEXT[presetFor(input) ?? ''] ?? CUSTOM_NEXT;
  return { preset: COMPARE_PRESETS.find((p) => p.id === next.id)!, why: next.why };
}

/** The end-of-run card's sentence: when the last run ended, then the headline. */
export function resultSentence(
  names: readonly string[],
  durationTicks: number,
  why: string,
): string {
  return `All ${names.length} runs have finished; the last one at t = ${durationTicks}. ${why}`;
}

export interface Variant {
  policy: Policy;
  /** What changed, for the menu and the status line: "quantum 4 → 8". */
  change: string;
}

/**
 * The same policy with one setting changed (C4): RR's quantum doubled (halved at the
 * cap), priority's preemption flipped, MLFQ's rule 4 swapped. FCFS, SJF and SRTF have no
 * settings, so they have no variant.
 */
export function variantOf(policy: Policy): Variant | null {
  switch (policy.kind) {
    case 'rr': {
      const doubled = policy.quantum * 2;
      const quantum =
        doubled <= LIMITS.maxQuantum
          ? doubled
          : Math.max(LIMITS.minQuantum, Math.floor(policy.quantum / 2));
      if (quantum === policy.quantum) return null;
      return {
        policy: { ...policy, quantum },
        change: `quantum ${policy.quantum} → ${quantum}`,
      };
    }
    case 'priority':
      return {
        policy: { ...policy, preemptive: !policy.preemptive },
        change: policy.preemptive ? 'non-preemptive' : 'preemptive',
      };
    case 'mlfq':
      return {
        policy: {
          ...policy,
          rule4: policy.rule4 === 'original' ? 'allotment' : 'original',
        },
        change:
          policy.rule4 === 'original'
            ? 'rule 4 by allotment'
            : 'old rule 4 (whole quantum only)',
      };
    case 'fcfs':
    case 'sjf':
    case 'srtf':
      return null;
  }
}
