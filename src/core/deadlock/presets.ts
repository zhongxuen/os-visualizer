/**
 * Deadlock presets: the classic situations (two locks, dining philosophers, a cycle that
 * is not a deadlock) and the OSC10 worked examples, each also a fixture test. Every
 * preset is in the scenario catalogue, so the determinism and citation tests run it.
 *
 * OSC10 numbers threads from T1 in its graph figures and names resources A, B, C in its
 * matrix examples; here everything is numbered from 0 (rule `dl.names`), and the
 * summaries say how the names map.
 */

import type { CitationId } from '../citations/types';
import { allocate } from './bankers';
import type { BankersState, Edge, Graph } from './model';
import type { Method } from './recover';

export interface GraphPreset {
  id: string;
  title: string;
  /** What to look for. */
  summary: string;
  citation: CitationId;
  graph: Graph;
  method: Method;
}

export interface BankersQuery {
  run: 'safety' | 'request';
  /** The requesting thread (ignored for a safety run). */
  t: number;
  /** One value per resource type (ignored for a safety run). */
  request: number[];
}

export interface BankersPreset {
  id: string;
  title: string;
  summary: string;
  citation: CitationId;
  state: BankersState;
  query: BankersQuery;
}

function edges(list: readonly [number, number, number?][]): Edge[] {
  return list.map(([t, r, n]) => ({ t, r, n: n ?? 1 }));
}

/** Edges from a matrix, row = thread, column = resource type. */
function edgesOf(matrix: readonly (readonly number[])[]): Edge[] {
  return matrix.flatMap((row, t) => row.flatMap((n, r) => (n > 0 ? [{ t, r, n }] : [])));
}

const DINING: Graph = {
  processes: 5,
  instances: [1, 1, 1, 1, 1],
  assignments: edges([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
  ]),
  requests: edges([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 0],
  ]),
};

/** OSC10 §8.7.2: Allocation and Request for T0–T4 over A, B, C = (7, 2, 6). */
export const OSC10_DETECT_ALLOCATION = [
  [0, 1, 0],
  [2, 0, 0],
  [3, 0, 3],
  [2, 1, 1],
  [0, 0, 2],
];
export const OSC10_DETECT_REQUEST = [
  [0, 0, 0],
  [2, 0, 2],
  [0, 0, 0],
  [1, 0, 0],
  [0, 0, 2],
];
/** The same, after T2 requests one more instance of C. */
export const OSC10_DETECT_REQUEST_AFTER = [
  [0, 0, 0],
  [2, 0, 2],
  [0, 0, 1],
  [1, 0, 0],
  [0, 0, 2],
];

export const GRAPH_PRESETS: readonly GraphPreset[] = [
  {
    id: 'two-locks',
    title: 'Two threads, two locks',
    summary:
      'T0 holds lock R0 and wants R1; T1 holds R1 and wants R0. The classic cycle: each waits for the other forever.',
    citation: 'ostep.32.3',
    method: 'cycle',
    graph: {
      processes: 2,
      instances: [1, 1],
      assignments: edges([
        [0, 0],
        [1, 1],
      ]),
      requests: edges([
        [0, 1],
        [1, 0],
      ]),
    },
  },
  {
    id: 'dining',
    title: 'Dining philosophers, 5 forks',
    summary:
      'Every philosopher Ti has picked up its left fork Ri and waits for its right fork R(i+1). Five threads in one cycle: deadlock.',
    citation: 'osc10.7.1.3',
    method: 'cycle',
    graph: DINING,
  },
  {
    id: 'dining-right-first',
    title: 'Dining philosophers, one picks right first',
    summary:
      'T4 reaches for its right fork R0 first, so it holds nothing while it waits and R4 stays free. No cycle: T3 can eat, then the rest in turn. Lock ordering in action.',
    citation: 'osc10.7.1.3',
    method: 'cycle',
    graph: {
      ...DINING,
      assignments: DINING.assignments.filter((e) => e.t !== 4),
    },
  },
  {
    id: 'cycle-no-deadlock',
    title: 'Cycle but no deadlock',
    summary:
      'OSC10 Figure 8.6 (book T1–T4 and R1–R2 are T0–T3 and R0–R1 here). The cycle T0 → R0 → T2 → R1 → T0 is real, but T3 can finish and free an instance of R1. With two instances, a cycle is not enough.',
    citation: 'osc10.8.3.2',
    method: 'cycle',
    graph: {
      processes: 4,
      instances: [2, 2],
      assignments: edges([
        [0, 1],
        [1, 0],
        [2, 0],
        [3, 1],
      ]),
      requests: edges([
        [0, 0],
        [2, 1],
      ]),
    },
  },
  {
    id: 'multi-deadlock',
    title: 'Multi-instance deadlock',
    summary:
      'OSC10 Figure 8.5 (book T1–T3 and R1–R4 are T0–T2 and R0–R3 here). R1 has two instances, but both are held by threads in the cycle, so nobody can finish.',
    citation: 'osc10.8.3.2',
    method: 'cycle',
    graph: {
      processes: 3,
      instances: [1, 2, 1, 3],
      assignments: edges([
        [0, 1],
        [1, 0],
        [1, 1],
        [2, 2],
      ]),
      requests: edges([
        [0, 0],
        [1, 2],
        [2, 1],
      ]),
    },
  },
  {
    id: 'osc10-detect',
    title: 'OSC10 detection example',
    summary:
      'OSC10 §8.7.2 (A, B, C are R0, R1, R2): five threads, nothing available, yet not deadlocked. T0 needs nothing more, and its release starts a chain.',
    citation: 'osc10.8.7.2',
    method: 'detect',
    graph: {
      processes: 5,
      instances: [7, 2, 6],
      assignments: edgesOf(OSC10_DETECT_ALLOCATION),
      requests: edgesOf(OSC10_DETECT_REQUEST),
    },
  },
  {
    id: 'osc10-detect-after',
    title: 'OSC10 detection, after T2’s extra request',
    summary:
      'The same state after T2 asks for one more C (R2). T0 can still finish, but what it frees is not enough for anyone else: T1, T2, T3 and T4 are deadlocked.',
    citation: 'osc10.8.7.2',
    method: 'detect',
    graph: {
      processes: 5,
      instances: [7, 2, 6],
      assignments: edgesOf(OSC10_DETECT_ALLOCATION),
      requests: edgesOf(OSC10_DETECT_REQUEST_AFTER),
    },
  },
];

/** OSC10 §8.6.3.3: T0–T4 over A, B, C = (10, 5, 7). */
export const OSC10_BANKERS: BankersState = {
  max: [
    [7, 5, 3],
    [3, 2, 2],
    [9, 0, 2],
    [2, 2, 2],
    [4, 3, 3],
  ],
  allocation: [
    [0, 1, 0],
    [2, 0, 0],
    [3, 0, 2],
    [2, 1, 1],
    [0, 0, 2],
  ],
  available: [3, 3, 2],
};

/** The OSC10 state after T1's (1, 0, 2) is granted. */
export const OSC10_BANKERS_AFTER_T1: BankersState = allocate(OSC10_BANKERS, {
  t: 1,
  request: [1, 0, 2],
});

export const BANKERS_PRESETS: readonly BankersPreset[] = [
  {
    id: 'osc10-safe',
    title: 'OSC10 Banker’s example: is it safe?',
    summary:
      'OSC10 §8.6.3.3 (A, B, C are R0, R1, R2). The state is safe. The book gives ⟨T1, T3, T4, T2, T0⟩; the lowest-index scan here finds ⟨T1, T3, T0, T2, T4⟩. Both work.',
    citation: 'osc10.8.6.3.3',
    state: OSC10_BANKERS,
    query: { run: 'safety', t: 0, request: [0, 0, 0] },
  },
  {
    id: 'osc10-t1',
    title: 'OSC10: T1 requests (1, 0, 2)',
    summary:
      'Within T1’s Need and within Available. Pretend to allocate, run safety: still safe, so the request is granted.',
    citation: 'osc10.8.6.3.3',
    state: OSC10_BANKERS,
    query: { run: 'request', t: 1, request: [1, 0, 2] },
  },
  {
    id: 'osc10-t4',
    title: 'OSC10: then T4 requests (3, 3, 0)',
    summary:
      'After T1’s request was granted, Available is (2, 3, 0). T4 asks for 3 of A: not enough is free, so T4 waits.',
    citation: 'osc10.8.6.3.3',
    state: OSC10_BANKERS_AFTER_T1,
    query: { run: 'request', t: 4, request: [3, 3, 0] },
  },
  {
    id: 'osc10-t0',
    title: 'OSC10: then T0 requests (0, 2, 0)',
    summary:
      'After T1’s grant, T0’s request fits in Available, but the resulting state is unsafe. Banker’s algorithm refuses and T0 waits.',
    citation: 'osc10.8.6.3.3',
    state: OSC10_BANKERS_AFTER_T1,
    query: { run: 'request', t: 0, request: [0, 2, 0] },
  },
  {
    id: 'exceed-claim',
    title: 'Exceeding the maximum claim',
    summary:
      'T3’s Need is (0, 1, 1), but it asks for (1, 0, 0). A thread may never ask for more than it declared: an error, not a wait.',
    citation: 'osc10.8.6.3.2',
    state: OSC10_BANKERS,
    query: { run: 'request', t: 3, request: [1, 0, 0] },
  },
];

export const DEFAULT_GRAPH_PRESET: GraphPreset = GRAPH_PRESETS[0]!;
export const DEFAULT_BANKERS_PRESET: BankersPreset = BANKERS_PRESETS[0]!;

export function graphPresetById(id: string): GraphPreset | undefined {
  return GRAPH_PRESETS.find((preset) => preset.id === id);
}

export function bankersPresetById(id: string): BankersPreset | undefined {
  return BANKERS_PRESETS.find((preset) => preset.id === id);
}

/** An empty graph to build from: two threads, two single-instance resources. */
export const EMPTY_GRAPH: Graph = {
  processes: 2,
  instances: [1, 1],
  assignments: [],
  requests: [],
};
