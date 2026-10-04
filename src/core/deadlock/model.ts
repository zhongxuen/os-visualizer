/**
 * The deadlock module's two inputs, with Zod schemas and hard limits:
 *
 * - a **resource-allocation graph** (OSC10 §8.3.2): threads `T0..T7` (OSC10 calls them
 *   threads, hence `T`), resource types `R0..R4` with 1..10 instances each, **assignment
 *   edges** `R → T` and **request edges** `T → R`, each with a count. The Allocation and
 *   Request matrices and the Available vector are *derived* from the edges, so the graph
 *   view and the matrix view can never disagree.
 * - a **Banker's state** (OSC10 §8.6.3): Max, Allocation and Available. Need = Max −
 *   Allocation is computed, never edited.
 *
 * Also the graph edits the form makes ("T2 holds 1 of R1"), each returning a validated
 * graph or the schema's messages, and the recovery actions (terminate, preempt).
 *
 * `zod/mini` for the same reason as the share-state codec: the editor validates in the
 * browser, and the full Zod API would cost the route its JS budget.
 */

import * as z from 'zod/mini';

export const LIMITS = {
  minProcesses: 1,
  maxProcesses: 8,
  minResources: 1,
  maxResources: 5,
  minInstances: 1,
  maxInstances: 10,
  /** Largest value in a Banker's matrix or vector cell. */
  maxBankerValue: 20,
  /** Recovery actions kept in one run. */
  maxRecovery: 16,
} as const;

export interface ValidationIssue {
  /** Where the problem is, e.g. `['assignments', 2]`. */
  path: (string | number)[];
  message: string;
}

export type Validation<T> =
  { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

// ---------------------------------------------------------------------------
// Names and vectors
// ---------------------------------------------------------------------------

export function processName(t: number): string {
  return `T${t}`;
}

export function resourceName(r: number): string {
  return `R${r}`;
}

/** A node of the resource-allocation graph: `'T1'` or `'R2'`. */
export type NodeId = string;

/** `[3, 3, 2]` → `(3, 3, 2)`. */
export function formatVector(values: readonly number[]): string {
  return `(${values.join(', ')})`;
}

/** Threads listed in a sentence: "T1", "T1 and T2", "T1, T2 and T4". */
export function listProcesses(ts: readonly number[]): string {
  const names = ts.map(processName);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** `a ≤ b` cell by cell. */
export function leq(a: readonly number[], b: readonly number[]): boolean {
  return a.every((value, i) => value <= (b[i] ?? 0));
}

export function addVec(a: readonly number[], b: readonly number[]): number[] {
  return a.map((value, i) => value + (b[i] ?? 0));
}

export function subVec(a: readonly number[], b: readonly number[]): number[] {
  return a.map((value, i) => value - (b[i] ?? 0));
}

export function isZero(values: readonly number[]): boolean {
  return values.every((value) => value === 0);
}

export function zeros(n: number): number[] {
  return Array.from({ length: n }, () => 0);
}

export function zeroMatrix(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => zeros(cols));
}

export function copyMatrix(m: readonly (readonly number[])[]): number[][] {
  return m.map((row) => [...row]);
}

function int(min: number, max: number, what: string) {
  return z
    .int(`${what} must be a whole number`)
    .check(
      z.gte(min, `${what} must be at least ${min}`),
      z.lte(max, `${what} must be at most ${max}`),
    );
}

function toIssues(issues: readonly { path: PropertyKey[]; message: string }[]) {
  return issues.map((issue) => ({
    path: issue.path.map((part) => (typeof part === 'number' ? part : String(part))),
    message: issue.message,
  }));
}

/** Adds each issue to a refinement context. */
function report<T>(issuesOf: (value: T) => ValidationIssue[]) {
  return z.superRefine<T>((value, ctx) => {
    for (const issue of issuesOf(value)) {
      ctx.addIssue({
        code: 'custom',
        message: issue.message,
        path: issue.path,
        input: value,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// The resource-allocation graph
// ---------------------------------------------------------------------------

/** An edge between thread `t` and resource type `r`, carrying `n` instances. */
export interface Edge {
  t: number;
  r: number;
  n: number;
}

export interface Graph {
  /** Threads `T0..T(processes − 1)`, 1..8 of them. */
  processes: number;
  /** Instances of each resource type `R0..`, 1..5 types of 1..10 instances. */
  instances: number[];
  /** `R → T`: `n` instances of `r` are held by `t`. */
  assignments: Edge[];
  /** `T → R`: `t` is waiting for `n` more instances of `r`. */
  requests: Edge[];
}

const EDGE_SCHEMA = z.object({
  t: int(0, LIMITS.maxProcesses - 1, 'Thread'),
  r: int(0, LIMITS.maxResources - 1, 'Resource'),
  n: int(1, LIMITS.maxInstances, 'Count'),
});

const EDGES_SCHEMA = z
  .array(EDGE_SCHEMA)
  .check(z.maxLength(LIMITS.maxProcesses * LIMITS.maxResources));

/** What is wrong with a graph whose fields each parse: ranges, duplicates, totals. */
export function graphIssues(graph: Graph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { processes, instances } = graph;
  const kinds = [
    ['assignments', graph.assignments],
    ['requests', graph.requests],
  ] as const;

  for (const [kind, edges] of kinds) {
    const seen = new Set<string>();
    edges.forEach((edge, i) => {
      const path = [kind, i];
      if (edge.t >= processes) {
        issues.push({ path, message: `${processName(edge.t)} does not exist` });
      }
      if (edge.r >= instances.length) {
        issues.push({ path, message: `${resourceName(edge.r)} does not exist` });
      }
      const key = `${edge.t}:${edge.r}`;
      if (seen.has(key)) {
        issues.push({
          path,
          message: `${processName(edge.t)} and ${resourceName(edge.r)} already have ${
            kind === 'assignments' ? 'an assignment' : 'a request'
          } edge`,
        });
      }
      seen.add(key);
    });
  }
  if (issues.length > 0) return issues;

  const { allocation } = deriveMatrices(graph);
  instances.forEach((total, r) => {
    const assigned = allocation.reduce((sum, row) => sum + row[r]!, 0);
    if (assigned > total) {
      issues.push({
        path: ['instances', r],
        message: `${resourceName(r)} has ${total} ${
          total === 1 ? 'instance' : 'instances'
        } but ${assigned} are assigned`,
      });
    }
  });
  graph.requests.forEach((edge, i) => {
    const held = allocation[edge.t]![edge.r]!;
    const total = instances[edge.r]!;
    if (held + edge.n > total) {
      issues.push({
        path: ['requests', i],
        message:
          held === 0
            ? `${processName(edge.t)} requests ${edge.n} of ${resourceName(edge.r)}, which has only ${total}`
            : `${processName(edge.t)} holds ${held} of ${resourceName(edge.r)} and requests ${edge.n} more, but it has only ${total}`,
      });
    }
  });
  return issues;
}

export const GRAPH_SCHEMA = z
  .object({
    processes: int(LIMITS.minProcesses, LIMITS.maxProcesses, 'Threads'),
    instances: z
      .array(int(LIMITS.minInstances, LIMITS.maxInstances, 'Instances'))
      .check(
        z.minLength(LIMITS.minResources, 'Add at least one resource type'),
        z.maxLength(LIMITS.maxResources, `At most ${LIMITS.maxResources} resource types`),
      ),
    assignments: EDGES_SCHEMA,
    requests: EDGES_SCHEMA,
  })
  .check(report<Graph>(graphIssues));

export function validateGraph(input: unknown): Validation<Graph> {
  const parsed = GRAPH_SCHEMA.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, issues: toIssues(parsed.error.issues) };
}

/** The matrices of a resource-allocation graph (OSC10 §8.7.2). */
export interface RagMatrices {
  /** Instances of each resource type. */
  total: number[];
  /** `allocation[t][r]`: instances of `r` held by `t`. */
  allocation: number[][];
  /** `request[t][r]`: instances of `r` that `t` is waiting for. */
  request: number[][];
  /** Instances not held by anyone: total − Σ allocation. */
  available: number[];
}

/** Allocation, Request and Available, read off the edges. Expects a valid graph. */
export function deriveMatrices(graph: Graph): RagMatrices {
  const m = graph.instances.length;
  const allocation = zeroMatrix(graph.processes, m);
  const request = zeroMatrix(graph.processes, m);
  for (const e of graph.assignments) allocation[e.t]![e.r]! += e.n;
  for (const e of graph.requests) request[e.t]![e.r]! += e.n;
  const available = graph.instances.map(
    (total, r) => total - allocation.reduce((sum, row) => sum + row[r]!, 0),
  );
  return { total: [...graph.instances], allocation, request, available };
}

/** The graph for some matrices, edges in thread then resource order. */
export function graphFromMatrices(
  total: readonly number[],
  allocation: readonly (readonly number[])[],
  request: readonly (readonly number[])[],
): Graph {
  const edges = (matrix: readonly (readonly number[])[]) =>
    matrix.flatMap((row, t) => row.flatMap((n, r) => (n > 0 ? [{ t, r, n }] : [])));
  return {
    processes: allocation.length,
    instances: [...total],
    assignments: edges(allocation),
    requests: edges(request),
  };
}

/** True when every resource type has exactly one instance (OSC10 §8.7.1). */
export function isSingleInstance(total: readonly number[]): boolean {
  return total.every((n) => n === 1);
}

// ---------------------------------------------------------------------------
// Graph edits (the form)
// ---------------------------------------------------------------------------

function sortEdges(edges: readonly Edge[]): Edge[] {
  return [...edges].sort((a, b) => a.t - b.t || a.r - b.r);
}

function addEdge(edges: readonly Edge[], t: number, r: number, n: number): Edge[] {
  const found = edges.find((e) => e.t === t && e.r === r);
  if (!found) return sortEdges([...edges, { t, r, n }]);
  return edges.map((e) => (e === found ? { ...e, n: e.n + n } : e));
}

export type EdgeKind = 'assignments' | 'requests';

/** `t` holds (assignments) or requests `n` more of `r`; adds to an existing edge. */
export function withEdge(
  graph: Graph,
  kind: EdgeKind,
  t: number,
  r: number,
  n: number,
): Validation<Graph> {
  return validateGraph({ ...graph, [kind]: addEdge(graph[kind], t, r, n) });
}

export function withoutEdge(graph: Graph, kind: EdgeKind, t: number, r: number): Graph {
  return { ...graph, [kind]: graph[kind].filter((e) => !(e.t === t && e.r === r)) };
}

export function withProcess(graph: Graph): Validation<Graph> {
  return validateGraph({ ...graph, processes: graph.processes + 1 });
}

/** Remove `t` and its edges; later threads move down one number. */
export function withoutProcess(graph: Graph, t: number): Validation<Graph> {
  const keep = (edges: readonly Edge[]) =>
    edges.filter((e) => e.t !== t).map((e) => (e.t > t ? { ...e, t: e.t - 1 } : e));
  return validateGraph({
    ...graph,
    processes: graph.processes - 1,
    assignments: keep(graph.assignments),
    requests: keep(graph.requests),
  });
}

export function withResource(graph: Graph, instances: number): Validation<Graph> {
  return validateGraph({ ...graph, instances: [...graph.instances, instances] });
}

/** Remove `r` and its edges; later resource types move down one number. */
export function withoutResource(graph: Graph, r: number): Validation<Graph> {
  const keep = (edges: readonly Edge[]) =>
    edges.filter((e) => e.r !== r).map((e) => (e.r > r ? { ...e, r: e.r - 1 } : e));
  return validateGraph({
    ...graph,
    instances: graph.instances.filter((_, i) => i !== r),
    assignments: keep(graph.assignments),
    requests: keep(graph.requests),
  });
}

export function withInstances(
  graph: Graph,
  r: number,
  instances: number,
): Validation<Graph> {
  return validateGraph({
    ...graph,
    instances: graph.instances.map((n, i) => (i === r ? instances : n)),
  });
}

// ---------------------------------------------------------------------------
// Recovery (OSC10 §8.8)
// ---------------------------------------------------------------------------

export type Recovery =
  /** Abort `t`: every instance it holds is released and its requests disappear. */
  | { kind: 'terminate'; t: number }
  /** Take one instance of `r` from `t`. `t` is rolled back and must request it again. */
  | { kind: 'preempt'; t: number; r: number };

export const RECOVERY_SCHEMA = z.union([
  z.object({
    kind: z.literal('terminate'),
    t: int(0, LIMITS.maxProcesses - 1, 'Thread'),
  }),
  z.object({
    kind: z.literal('preempt'),
    t: int(0, LIMITS.maxProcesses - 1, 'Thread'),
    r: int(0, LIMITS.maxResources - 1, 'Resource'),
  }),
]);

export function describeRecovery(action: Recovery): string {
  return action.kind === 'terminate'
    ? `Terminate ${processName(action.t)}`
    : `Preempt 1 of ${resourceName(action.r)} from ${processName(action.t)}`;
}

/** The matrices after `action`, or why it can't be done. */
export function applyRecovery(
  m: RagMatrices,
  terminated: readonly number[],
  action: Recovery,
): { ok: true; value: RagMatrices } | { ok: false; message: string } {
  const { t } = action;
  if (t >= m.allocation.length)
    return { ok: false, message: `${processName(t)} does not exist` };
  if (terminated.includes(t)) {
    return { ok: false, message: `${processName(t)} was already terminated` };
  }
  const allocation = copyMatrix(m.allocation);
  const request = copyMatrix(m.request);
  if (action.kind === 'terminate') {
    allocation[t] = zeros(m.total.length);
    request[t] = zeros(m.total.length);
  } else {
    const { r } = action;
    if (r >= m.total.length)
      return { ok: false, message: `${resourceName(r)} does not exist` };
    if (allocation[t]![r]! < 1) {
      return {
        ok: false,
        message: `${processName(t)} holds no instance of ${resourceName(r)}`,
      };
    }
    allocation[t]![r]! -= 1;
    request[t]![r]! += 1;
  }
  const available = m.total.map(
    (total, r) => total - allocation.reduce((sum, row) => sum + row[r]!, 0),
  );
  return { ok: true, value: { total: [...m.total], allocation, request, available } };
}

/** Problems with applying `recovery` to `graph` in order, each naming its action. */
export function recoveryIssues(
  graph: Graph,
  recovery: readonly Recovery[],
): ValidationIssue[] {
  let m = deriveMatrices(graph);
  const terminated: number[] = [];
  for (const [i, action] of recovery.entries()) {
    const next = applyRecovery(m, terminated, action);
    if (!next.ok) return [{ path: ['recovery', i], message: next.message }];
    m = next.value;
    if (action.kind === 'terminate') terminated.push(action.t);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Banker's state (OSC10 §8.6.3)
// ---------------------------------------------------------------------------

export interface BankersState {
  /** `max[t][r]`: the most of `r` thread `t` may ever hold (its declared claim). */
  max: number[][];
  /** `allocation[t][r]`: what `t` holds now. */
  allocation: number[][];
  /** Instances of each type free now. */
  available: number[];
}

export interface BankersRequest {
  t: number;
  request: number[];
}

/** Need = Max − Allocation. */
export function needOf(state: BankersState): number[][] {
  return state.max.map((row, t) => subVec(row, state.allocation[t]!));
}

/** Total instances of each type: Available + Σ Allocation. */
export function bankersTotal(state: BankersState): number[] {
  return state.available.map(
    (free, r) => free + state.allocation.reduce((sum, row) => sum + (row[r] ?? 0), 0),
  );
}

const CELL = int(0, LIMITS.maxBankerValue, 'Value');

const MATRIX_SCHEMA = z
  .array(z.array(CELL))
  .check(
    z.minLength(LIMITS.minProcesses, 'Add at least one thread'),
    z.maxLength(LIMITS.maxProcesses, `At most ${LIMITS.maxProcesses} threads`),
  );

export function bankersIssues(state: BankersState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const cols = state.available.length;
  if (cols < LIMITS.minResources || cols > LIMITS.maxResources) {
    issues.push({
      path: ['available'],
      message: `Use 1 to ${LIMITS.maxResources} resource types`,
    });
  }
  if (state.max.length !== state.allocation.length) {
    issues.push({
      path: ['allocation'],
      message: 'Max and Allocation need the same threads',
    });
  }
  for (const [name, matrix] of [
    ['max', state.max],
    ['allocation', state.allocation],
  ] as const) {
    matrix.forEach((row, t) => {
      if (row.length !== cols) {
        issues.push({
          path: [name, t],
          message: `${processName(t)} needs ${cols} ${cols === 1 ? 'value' : 'values'}`,
        });
      }
    });
  }
  if (issues.length > 0) return issues;
  state.allocation.forEach((row, t) =>
    row.forEach((held, r) => {
      const max = state.max[t]![r]!;
      if (held > max) {
        issues.push({
          path: ['allocation', t, r],
          message: `${processName(t)} holds ${held} of ${resourceName(r)} but its maximum is ${max}`,
        });
      }
    }),
  );
  return issues;
}

export const BANKERS_SCHEMA = z
  .object({
    max: MATRIX_SCHEMA,
    allocation: MATRIX_SCHEMA,
    available: z.array(CELL),
  })
  .check(report<BankersState>(bankersIssues));

export function validateBankers(input: unknown): Validation<BankersState> {
  const parsed = BANKERS_SCHEMA.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, issues: toIssues(parsed.error.issues) };
}

export const BANKERS_REQUEST_SCHEMA = z.object({
  t: int(0, LIMITS.maxProcesses - 1, 'Thread'),
  request: z.array(CELL).check(z.maxLength(LIMITS.maxResources)),
});

/** A request that fits the state's shape (the algorithm decides whether it is granted). */
export function requestIssues(
  state: BankersState,
  request: BankersRequest,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (request.t >= state.max.length) {
    issues.push({ path: ['t'], message: `${processName(request.t)} does not exist` });
  }
  if (request.request.length !== state.available.length) {
    issues.push({
      path: ['request'],
      message: `A request needs ${state.available.length} values, one per resource type`,
    });
  }
  return issues;
}

/** Resize a Banker's state to `processes` × `resources`, keeping what fits. */
export function resizeBankers(
  state: BankersState,
  processes: number,
  resources: number,
): BankersState {
  const fit = (row: readonly number[] | undefined) =>
    Array.from({ length: resources }, (_, r) => row?.[r] ?? 0);
  return {
    max: Array.from({ length: processes }, (_, t) => fit(state.max[t])),
    allocation: Array.from({ length: processes }, (_, t) => fit(state.allocation[t])),
    available: fit(state.available),
  };
}
