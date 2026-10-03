/**
 * Scheduling presets: the textbook worked examples (each also a fixture test) and the
 * classic situations (convoy, starvation, quantum too small or too big, MLFQ). Every
 * preset is in the scenario catalogue, so the determinism and citation tests run it.
 */

import type { CitationId } from '../citations/types';
import type { Policy, Process, Workload } from './workload';

export interface SchedPreset {
  id: string;
  title: string;
  /** What to look for. */
  summary: string;
  citation: CitationId;
  workload: Workload;
  policy: Policy;
}

/** `P1`.. with arrival 0 and priority 0 unless given. */
function procs(
  list: readonly (readonly [number, number[]] | readonly [number, number[], number])[],
): Process[] {
  return list.map(([arrival, bursts, priority = 0], i) => ({
    pid: `P${i + 1}`,
    arrival,
    bursts: [...bursts],
    priority,
  }));
}

function bursts(...lengths: number[]): Process[] {
  return lengths.map((burst, i) => ({
    pid: `P${i + 1}`,
    arrival: 0,
    bursts: [burst],
    priority: 0,
  }));
}

const OSC_FCFS: Workload = { processes: bursts(24, 3, 3), contextSwitch: 0 };
const OSC_SJF: Workload = { processes: bursts(6, 8, 7, 3), contextSwitch: 0 };
const OSC_SRTF: Workload = {
  processes: procs([
    [0, [8]],
    [1, [4]],
    [2, [9]],
    [3, [5]],
  ]),
  contextSwitch: 0,
};
const OSC_PRIORITY: Workload = {
  processes: procs([
    [0, [10], 3],
    [0, [1], 1],
    [0, [2], 4],
    [0, [1], 5],
    [0, [5], 2],
  ]),
  contextSwitch: 0,
};
const OSTEP_ABC: Workload = { processes: bursts(100, 10, 10), contextSwitch: 0 };
const OSTEP_STCF: Workload = {
  processes: procs([
    [0, [100]],
    [10, [10]],
    [10, [10]],
  ]),
  contextSwitch: 0,
};
const OSTEP_RR: Workload = { processes: bursts(5, 5, 5), contextSwitch: 0 };

export const CONVOY: Workload = {
  processes: procs([
    [0, [16]],
    [1, [2]],
    [1, [3]],
    [2, [2]],
  ]),
  contextSwitch: 0,
};

const SJF_STARVATION: Workload = {
  processes: procs([
    [0, [10]],
    [0, [3]],
    [2, [3]],
    [5, [3]],
    [8, [3]],
    [11, [3]],
    [14, [3]],
  ]),
  contextSwitch: 0,
};

export const RR_WORKLOAD: Workload = {
  processes: procs([
    [0, [7]],
    [0, [4]],
    [1, [5]],
    [2, [3]],
  ]),
  contextSwitch: 1,
};

const PRIORITY_STARVATION: Workload = {
  processes: procs([
    [0, [4], 9],
    [0, [3], 1],
    [2, [3], 2],
    [5, [3], 1],
    [8, [3], 2],
    [11, [3], 1],
    [14, [3], 1],
  ]),
  contextSwitch: 0,
};

export const MLFQ_INTERACTIVE: Workload = {
  processes: procs([
    [0, [20]],
    [2, [1, 3, 1, 3, 1, 3, 1, 3, 1]],
  ]),
  contextSwitch: 0,
};

const MLFQ_INTERACTIVE_LEVELS = [
  { quantum: 2, allotment: 6 },
  { quantum: 4, allotment: 8 },
  { quantum: 8, allotment: 8 },
];

const MLFQ_GAMING: Workload = {
  processes: procs([
    [0, [24]],
    [0, [3, 1, 3, 1, 3, 1, 3, 1, 3]],
  ]),
  contextSwitch: 0,
};

const MLFQ_GAMING_LEVELS = [
  { quantum: 4, allotment: 4 },
  { quantum: 4, allotment: 4 },
  { quantum: 4, allotment: 4 },
];

const MLFQ_BOOST: Workload = {
  processes: procs([
    [0, [16]],
    [2, [1, 1, 1, 1, 1, 1, 1, 1, 1]],
    [3, [1, 1, 1, 1, 1, 1, 1, 1, 1]],
  ]),
  contextSwitch: 0,
};

const MLFQ_BOOST_LEVELS = [
  { quantum: 2, allotment: 2 },
  { quantum: 2, allotment: 2 },
  { quantum: 2, allotment: 2 },
];

export const SCHED_PRESETS: readonly SchedPreset[] = [
  {
    id: 'osc-fcfs',
    title: 'OSC10 FCFS (24, 3, 3)',
    summary:
      'P1 (24 ticks) arrives first, so the short jobs wait behind it: average waiting time 17.',
    citation: 'osc10.5.3.1',
    workload: OSC_FCFS,
    policy: { kind: 'fcfs' },
  },
  {
    id: 'osc-sjf',
    title: 'OSC10 SJF (6, 8, 7, 3)',
    summary: 'Shortest next burst first: P4, P1, P3, P2. Average waiting time 7.',
    citation: 'osc10.5.3.2',
    workload: OSC_SJF,
    policy: { kind: 'sjf' },
  },
  {
    id: 'osc-srtf',
    title: 'OSC10 SRTF (arrivals 0–3)',
    summary:
      'P2 arrives with less time left than P1 and preempts it. Average waiting 6.5.',
    citation: 'osc10.5.3.2',
    workload: OSC_SRTF,
    policy: { kind: 'srtf' },
  },
  {
    id: 'osc-rr',
    title: 'OSC10 Round Robin, q = 4',
    summary:
      'P1 is cut every 4 ticks; P2 and P3 finish early. Average waiting 17/3 ≈ 5.67.',
    citation: 'osc10.5.3.3',
    workload: OSC_FCFS,
    policy: { kind: 'rr', quantum: 4 },
  },
  {
    id: 'osc-priority',
    title: 'OSC10 Priority (non-preemptive)',
    summary: 'Lower number = higher priority: P2, P5, P1, P3, P4. Average waiting 8.2.',
    citation: 'osc10.5.3.4',
    workload: OSC_PRIORITY,
    policy: { kind: 'priority', preemptive: false },
  },
  {
    id: 'ostep-fifo',
    title: 'OSTEP FIFO (A = 100, B = C = 10)',
    summary: 'A long job first hurts everyone behind it: average turnaround 110.',
    citation: 'ostep.7.3',
    workload: OSTEP_ABC,
    policy: { kind: 'fcfs' },
  },
  {
    id: 'ostep-sjf',
    title: 'OSTEP SJF (A = 100, B = C = 10)',
    summary: 'Running the short jobs first cuts average turnaround to 50.',
    citation: 'ostep.7.4',
    workload: OSTEP_ABC,
    policy: { kind: 'sjf' },
  },
  {
    id: 'ostep-stcf',
    title: 'OSTEP STCF (B, C arrive at 10)',
    summary: 'B and C preempt A when they arrive: average turnaround 50.',
    citation: 'ostep.7.5',
    workload: OSTEP_STCF,
    policy: { kind: 'srtf' },
  },
  {
    id: 'ostep-rr',
    title: 'OSTEP RR, slice 1 (A = B = C = 5)',
    summary: 'Every job starts almost at once: average response time 1 (SJF gives 5).',
    citation: 'ostep.7.7',
    workload: OSTEP_RR,
    policy: { kind: 'rr', quantum: 1 },
  },
  {
    id: 'convoy',
    title: 'Convoy effect (FCFS)',
    summary: 'One long job arrives first and three short jobs queue behind it.',
    citation: 'osc10.5.3.1',
    workload: CONVOY,
    policy: { kind: 'fcfs' },
  },
  {
    id: 'sjf-starvation',
    title: 'SJF starvation',
    summary:
      'A stream of short jobs keeps arriving, so the long job P1 waits until they are all done.',
    citation: 'osc10.5.3.2',
    workload: SJF_STARVATION,
    policy: { kind: 'sjf' },
  },
  {
    id: 'rr-small-quantum',
    title: 'RR quantum too small (q = 1, CS = 1)',
    summary:
      'Every tick of work costs a tick of context switching: utilisation collapses.',
    citation: 'osc10.5.3.3',
    workload: RR_WORKLOAD,
    policy: { kind: 'rr', quantum: 1 },
  },
  {
    id: 'rr-big-quantum',
    title: 'RR quantum too big (q = 10)',
    summary: 'No burst is longer than the quantum, so RR behaves exactly like FCFS.',
    citation: 'osc10.5.3.3',
    workload: RR_WORKLOAD,
    policy: { kind: 'rr', quantum: 10 },
  },
  {
    id: 'priority-starvation',
    title: 'Priority starvation (no aging)',
    summary: 'P1 has priority 9 and higher-priority jobs keep arriving: it runs last.',
    citation: 'osc10.5.3.4',
    workload: PRIORITY_STARVATION,
    policy: { kind: 'priority', preemptive: false },
  },
  {
    id: 'priority-aging',
    title: 'Priority starvation, with aging',
    summary:
      'The same workload with aging (−2 every 2 ticks waited): P1 reaches priority 1 and runs at t = 9.',
    citation: 'osc10.5.3.4',
    workload: PRIORITY_STARVATION,
    policy: { kind: 'priority', preemptive: false, aging: { every: 2, by: 2 } },
  },
  {
    id: 'mlfq-interactive',
    title: 'MLFQ: interactive vs batch',
    summary:
      'The CPU-bound P1 sinks to the bottom queue; the I/O-bound P2 runs 1 tick at a time and stays in Q0.',
    citation: 'ostep.8.2',
    workload: MLFQ_INTERACTIVE,
    policy: { kind: 'mlfq', levels: MLFQ_INTERACTIVE_LEVELS, rule4: 'allotment' },
  },
  {
    id: 'mlfq-gaming-old',
    title: 'MLFQ gaming (old rule 4)',
    summary:
      'P2 does I/O just before its quantum ends, keeps Q0 and takes most of the CPU from P1.',
    citation: 'ostep.8.4',
    workload: MLFQ_GAMING,
    policy: { kind: 'mlfq', levels: MLFQ_GAMING_LEVELS, rule4: 'original' },
  },
  {
    id: 'mlfq-gaming-new',
    title: 'MLFQ gaming fixed (allotment)',
    summary:
      'The same trick under the new rule 4: time is counted across I/O, so P2 moves down after 4 ticks.',
    citation: 'ostep.8.4',
    workload: MLFQ_GAMING,
    policy: { kind: 'mlfq', levels: MLFQ_GAMING_LEVELS, rule4: 'allotment' },
  },
  {
    id: 'mlfq-boost',
    title: 'MLFQ priority boost',
    summary:
      'Two interactive jobs keep Q0 busy and P1 starves in Q1; a boost every 5 ticks lifts P1 back to Q0.',
    citation: 'ostep.8.3',
    workload: MLFQ_BOOST,
    policy: {
      kind: 'mlfq',
      levels: MLFQ_BOOST_LEVELS,
      boostEvery: 5,
      rule4: 'original',
    },
  },
];

export function presetById(id: string): SchedPreset | undefined {
  return SCHED_PRESETS.find((preset) => preset.id === id);
}

/** The workload the scheduling page opens with. */
export const DEFAULT_PRESET = SCHED_PRESETS.find((p) => p.id === 'osc-sjf')!;
