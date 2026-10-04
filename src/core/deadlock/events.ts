import type { EventBase } from '../events/types';
import type { NodeId } from './model';

/**
 * Deadlock events. Four kinds of run share them:
 *
 * - **cycle detection** (single-instance graphs, OSC10 §8.7.1): `dl.wfg` builds the
 *   wait-for graph, then a deterministic DFS steps `dl.visit` → `dl.edge` … →
 *   `dl.backtrack`, ending in `dl.cycle` or `dl.acyclic`. On a graph with a
 *   multi-instance resource, `dl.multi` explains why a cycle is not enough and hands over
 *   to detection.
 * - **detection** (OSC10 §8.7.2) and **Banker's safety** (§8.6.3.1): `dl.init` (Work,
 *   Finish) → `dl.check` per row (Request_i or Need_i ≤ Work?) → `dl.finish` (release) …
 *   → `dl.result`.
 * - **Banker's request** (§8.6.3.2): `dl.req.need` → `dl.req.available` →
 *   `dl.req.pretend` → the safety steps → `dl.req.grant` or `dl.req.rollback`. A failed
 *   check ends the run there.
 * - **recovery** (§8.8): `dl.recover`, then detection again on the new graph.
 *
 * Every event carries the full state after it (`DlSnapshot`), so the UI steps by lookup.
 * Plain JSON only: absent values are `null`, never `undefined`.
 */

export type DlEventKind =
  | 'dl.wfg'
  | 'dl.multi'
  | 'dl.visit'
  | 'dl.edge'
  | 'dl.backtrack'
  | 'dl.cycle'
  | 'dl.acyclic'
  | 'dl.init'
  | 'dl.check'
  | 'dl.finish'
  | 'dl.result'
  | 'dl.req.need'
  | 'dl.req.available'
  | 'dl.req.pretend'
  | 'dl.req.grant'
  | 'dl.req.rollback'
  | 'dl.recover';

export type DlAlgorithm = 'cycle' | 'detect' | 'safety' | 'request' | 'recover';

/** A wait-for edge `from → to`: `from` waits for `resource`, which `to` holds. */
export interface WaitEdge {
  from: number;
  to: number;
  resource: number;
}

/** DFS colours: 0 not visited, 1 on the stack, 2 done. */
export type DfsColour = 0 | 1 | 2;

export interface DfsState {
  /** One colour per thread. */
  colour: DfsColour[];
  /** The DFS path, root first. */
  stack: number[];
  /** The wait-for edge being looked at, when there is one. */
  edge: WaitEdge | null;
}

/** Which comparison a step made, for the matrix highlight. */
export interface DlCompare {
  /** The row's matrix. */
  matrix: 'request' | 'need';
  /** What it was compared with. */
  against: 'work' | 'available' | 'need';
  row: number;
  /** The vector compared, e.g. Request_i. */
  values: number[];
  fits: boolean;
}

export type DlResult =
  | { kind: 'cycle'; cycle: NodeId[] }
  | { kind: 'acyclic' }
  | { kind: 'not-deadlocked'; order: number[] }
  | { kind: 'deadlocked'; set: number[] }
  | { kind: 'safe'; order: number[] }
  | { kind: 'unsafe'; stuck: number[] }
  | { kind: 'granted' }
  /** Request > Need: the thread exceeded its maximum claim. */
  | { kind: 'error' }
  /** Request > Available: the thread must wait. */
  | { kind: 'wait' }
  /** The pretend allocation was unsafe, so it is rolled back and the thread waits. */
  | { kind: 'refused' };

export interface DlSnapshot {
  algorithm: DlAlgorithm;
  /** Instances of each resource type. */
  total: number[];
  allocation: number[][];
  /** Detection only: what each thread is waiting for. */
  request: number[][] | null;
  /** Banker's only. */
  max: number[][] | null;
  /** Banker's only: Max − Allocation. */
  need: number[][] | null;
  available: number[];
  /** Detection and safety: the work vector, `null` before it is set up. */
  work: number[] | null;
  finish: boolean[] | null;
  /** Threads that finished, in order. */
  order: number[];
  /** The row this step is about. */
  row: number | null;
  /** Cells this step changed, as `[row, col]`, in Allocation (or Need). */
  changed: [number, number][];
  compare: DlCompare | null;
  /** Cycle detection: the wait-for graph. */
  waitFor: WaitEdge[] | null;
  dfs: DfsState | null;
  /** The cycle found, as graph nodes, first node repeated at the end. */
  cycle: NodeId[] | null;
  /** Recovery so far. */
  terminated: number[];
  preempted: { t: number; r: number }[];
  /** Set on the step that decides. */
  result: DlResult | null;
}

export type DlEvent = EventBase & {
  kind: DlEventKind;
  /** The thread the event is about, when there is one. */
  process?: number;
  /** The resource type the event is about, when there is one. */
  resource?: number;
  state: DlSnapshot;
};
