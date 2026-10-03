/**
 * Compare: one workload under 2-4 policies. No scheduling logic lives here; each run is
 * exactly `schedule(workload, policy)`.
 *
 * The comparison has its own timeline: a tick run of length `durationTicks` (the longest
 * run), one phase per tick, so one playback store drives every chart. A run that has
 * already finished simply shows as complete.
 */

import { createRun } from '../events/builder';
import type { SimResult, TimedEvent } from '../sim/result';
import { runMetrics, type RunMetrics } from './metrics';
import { CONVOY, MLFQ_INTERACTIVE, RR_WORKLOAD } from './presets';
import { schedule, type SchedRun } from './schedule';
import { policyName, type Policy, type Workload } from './workload';

export const MIN_COMPARE = 2;
export const MAX_COMPARE = 4;

export type CompareRowId =
  | 'waiting'
  | 'turnaround'
  | 'response'
  | 'utilisation'
  | 'throughput'
  | 'contextSwitches';

export interface CompareRow {
  id: CompareRowId;
  label: string;
  /** What the "Why?" line calls it, e.g. "average waiting time". */
  phrase: string;
  values: number[];
  better: 'lower' | 'higher';
}

export interface CompareResult {
  runs: SchedRun[];
  metrics: RunMetrics[];
  /** Column labels, one per policy, unique ("RR q=4", "RR q=4 (2)"). */
  names: string[];
  durationTicks: number;
  table: CompareRow[];
  /** One phase per tick, `durationTicks` long. */
  timeline: SimResult<TimedEvent & { id: string }>;
}

/** Policy names, made unique by numbering repeats. */
export function columnNames(policies: readonly Policy[]): string[] {
  const seen = new Map<string, number>();
  return policies.map((policy) => {
    const name = policyName(policy);
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name} (${count})`;
  });
}

const ROWS: readonly Omit<CompareRow, 'values'>[] = [
  {
    id: 'waiting',
    label: 'Average waiting',
    phrase: 'average waiting time',
    better: 'lower',
  },
  {
    id: 'turnaround',
    label: 'Average turnaround',
    phrase: 'average turnaround time',
    better: 'lower',
  },
  {
    id: 'response',
    label: 'Average response',
    phrase: 'average response time',
    better: 'lower',
  },
  {
    id: 'utilisation',
    label: 'CPU utilisation',
    phrase: 'CPU utilisation',
    better: 'higher',
  },
  { id: 'throughput', label: 'Throughput', phrase: 'throughput', better: 'higher' },
  {
    id: 'contextSwitches',
    label: 'Context switches',
    phrase: 'number of context switches',
    better: 'lower',
  },
];

function valueOf(metrics: RunMetrics, id: CompareRowId): number {
  switch (id) {
    case 'waiting':
      return metrics.avgWaiting;
    case 'turnaround':
      return metrics.avgTurnaround;
    case 'response':
      return metrics.avgResponse;
    case 'utilisation':
      return metrics.utilisation;
    case 'throughput':
      return metrics.throughput;
    case 'contextSwitches':
      return metrics.contextSwitches;
  }
}

/** A comparison timeline: one phase and one event per tick. */
export function tickTimeline(
  durationTicks: number,
): SimResult<TimedEvent & { id: string }> {
  const run = createRun<TimedEvent & { id: string }>({ unit: 'tick' });
  for (let t = 0; t <= durationTicks; t += 1) {
    if (t < durationTicks) run.phase(`t${t}`, `t = ${t}`, `Tick ${t} to ${t + 1}.`);
    run.emit({ id: `compare.${t}` });
    if (t < durationTicks) run.advance();
  }
  return run.finish();
}

export function compare(workload: Workload, policies: readonly Policy[]): CompareResult {
  if (policies.length < MIN_COMPARE || policies.length > MAX_COMPARE) {
    throw new RangeError(`compare takes ${MIN_COMPARE}-${MAX_COMPARE} policies`);
  }
  const runs = policies.map((policy) => schedule(workload, policy));
  const metrics = runs.map((run) => runMetrics(workload, run));
  const durationTicks = Math.max(...runs.map((run) => run.durationMs / 1000));
  const table = ROWS.map((row) => ({
    ...row,
    values: metrics.map((m) => valueOf(m, row.id)),
  }));
  return {
    runs,
    metrics,
    names: columnNames(policies),
    durationTicks,
    table,
    timeline: tickTimeline(durationTicks),
  };
}

/** Indexes of the best value in a row; ties all count. Rounded to avoid float noise. */
export function bestIndexes(row: Pick<CompareRow, 'values' | 'better'>): number[] {
  const rounded = row.values.map((v) => Math.round(v * 1e6) / 1e6);
  const best = row.better === 'lower' ? Math.min(...rounded) : Math.max(...rounded);
  return rounded.flatMap((v, i) => (v === best ? [i] : []));
}

function list(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export interface WhyPart {
  row: CompareRowId;
  best: number[];
  text: string;
}

/** The rows the "Why?" line talks about, in order. */
export const WHY_ROWS: readonly CompareRowId[] = [
  'waiting',
  'turnaround',
  'response',
  'contextSwitches',
];

/**
 * The "Why?" line, generated from the numbers: who is best on each headline row.
 * "SRTF has the lowest average waiting time; RR q=2 has the lowest average response time."
 */
export function whyParts(
  table: readonly CompareRow[],
  names: readonly string[],
): WhyPart[] {
  return WHY_ROWS.map((id) => {
    const row = table.find((r) => r.id === id)!;
    const best = bestIndexes(row);
    const extreme = row.better === 'lower' ? 'lowest' : 'highest';
    const who = best.map((i) => names[i]!);
    const text =
      best.length === names.length
        ? `${names.length === 2 ? 'both' : `all ${names.length}`} tie on ${row.phrase}`
        : best.length === 1
          ? `${who[0]} has the ${extreme} ${row.phrase}`
          : `${list(who)} tie for the ${extreme} ${row.phrase}`;
    return { row: id, best, text };
  });
}

export function whyLine(table: readonly CompareRow[], names: readonly string[]): string {
  const parts = whyParts(table, names).map((part) => part.text);
  const sentence = parts.join('; ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

export interface ComparePreset {
  id: string;
  title: string;
  summary: string;
  workload: Workload;
  policies: Policy[];
}

const RESPONSE_WORKLOAD: Workload = {
  processes: [
    { pid: 'P1', arrival: 0, bursts: [8], priority: 0 },
    { pid: 'P2', arrival: 0, bursts: [4], priority: 0 },
    { pid: 'P3', arrival: 0, bursts: [6], priority: 0 },
  ],
  contextSwitch: 0,
};

export const COMPARE_PRESETS: readonly ComparePreset[] = [
  {
    id: 'fcfs-sjf-srtf',
    title: 'FCFS vs SJF vs SRTF (convoy)',
    summary: 'One long job arrives first. SJF and SRTF let the short jobs past it.',
    workload: CONVOY,
    policies: [{ kind: 'fcfs' }, { kind: 'sjf' }, { kind: 'srtf' }],
  },
  {
    id: 'rr-sweep',
    title: 'RR quantum sweep (CS = 1)',
    summary: 'q = 1, 2, 4, 8 with a 1-tick context switch: fewer switches as q grows.',
    workload: RR_WORKLOAD,
    policies: [
      { kind: 'rr', quantum: 1 },
      { kind: 'rr', quantum: 2 },
      { kind: 'rr', quantum: 4 },
      { kind: 'rr', quantum: 8 },
    ],
  },
  {
    id: 'response-vs-turnaround',
    title: 'Response vs turnaround (SJF vs RR)',
    summary: 'SJF wins on turnaround; RR wins on response time.',
    workload: RESPONSE_WORKLOAD,
    policies: [{ kind: 'sjf' }, { kind: 'rr', quantum: 2 }],
  },
  {
    id: 'mlfq-vs-rr',
    title: 'MLFQ vs RR (I/O-bound job)',
    summary: 'MLFQ keeps the I/O-bound job in Q0, so it responds faster than under RR.',
    workload: MLFQ_INTERACTIVE,
    policies: [
      {
        kind: 'mlfq',
        levels: [
          { quantum: 2, allotment: 6 },
          { quantum: 4, allotment: 8 },
          { quantum: 8, allotment: 8 },
        ],
        rule4: 'allotment',
      },
      { kind: 'rr', quantum: 4 },
    ],
  },
];

export const DEFAULT_COMPARE_PRESET = COMPARE_PRESETS[0]!;
