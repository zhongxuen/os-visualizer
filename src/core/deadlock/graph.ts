/**
 * Cycles: the wait-for graph (OSC10 §8.7.1) and a deterministic DFS over it, and the
 * same DFS over the full resource-allocation graph (for the circular-wait condition and
 * the text summary).
 *
 * **DFS rule:** start from the lowest-numbered unvisited node, take neighbours in
 * ascending order, and stop at the first back edge, which closes the cycle reported. In
 * the resource-allocation graph threads are numbered before resource types.
 */

import type { DfsColour, DfsState, WaitEdge } from './events';
import type { Emitter } from './emitter';
import {
  listProcesses,
  processName,
  resourceName,
  type NodeId,
  type RagMatrices,
} from './model';

/**
 * `Ti → Tj` when Ti waits for a resource type Tj holds. The edge names the
 * lowest-numbered such resource. Sorted by `from`, then `to`.
 */
export function waitForGraph(m: Pick<RagMatrices, 'allocation' | 'request'>): WaitEdge[] {
  const edges: WaitEdge[] = [];
  const n = m.allocation.length;
  for (let from = 0; from < n; from += 1) {
    for (let to = 0; to < n; to += 1) {
      if (from === to) continue;
      const resource = m.request[from]!.findIndex(
        (wanted, r) => wanted > 0 && m.allocation[to]![r]! > 0,
      );
      if (resource !== -1) edges.push({ from, to, resource });
    }
  }
  return edges;
}

export type DfsStep =
  | { kind: 'visit'; node: number; state: DfsState }
  | { kind: 'edge'; from: number; to: number; seen: DfsColour; state: DfsState }
  | { kind: 'backtrack'; node: number; state: DfsState }
  | { kind: 'cycle'; cycle: number[]; state: DfsState };

/**
 * The DFS, step by step, over nodes `0..n − 1` with `adjacency[u]` in any order (it is
 * sorted here). Ends at the first back edge, with `cycle` = the path from the node it
 * reaches back to, through the current node, and back to the start: `[a, b, …, a]`.
 */
export function dfsTrace(
  n: number,
  adjacency: readonly (readonly number[])[],
): { steps: DfsStep[]; cycle: number[] | null } {
  const sorted = adjacency.map((next) => [...next].sort((a, b) => a - b));
  const colour: DfsColour[] = Array.from({ length: n }, () => 0 as const);
  const stack: number[] = [];
  const steps: DfsStep[] = [];
  // The edge is filled in by whoever knows which resource it goes through.
  const snap = (): DfsState => ({ colour: [...colour], stack: [...stack], edge: null });

  const visit = (u: number): number[] | null => {
    colour[u] = 1;
    stack.push(u);
    steps.push({ kind: 'visit', node: u, state: snap() });
    for (const v of sorted[u]!) {
      const seen = colour[v]!;
      steps.push({ kind: 'edge', from: u, to: v, seen, state: snap() });
      if (seen === 1) {
        const cycle = [...stack.slice(stack.indexOf(v)), v];
        steps.push({ kind: 'cycle', cycle, state: snap() });
        return cycle;
      }
      if (seen === 0) {
        const found = visit(v);
        if (found) return found;
      }
    }
    colour[u] = 2;
    stack.pop();
    steps.push({ kind: 'backtrack', node: u, state: snap() });
    return null;
  };

  for (let root = 0; root < n; root += 1) {
    if (colour[root] !== 0) continue;
    const cycle = visit(root);
    if (cycle) return { steps, cycle };
  }
  return { steps, cycle: null };
}

/** The first cycle the DFS finds, or `null`. */
export function findCycle(
  n: number,
  adjacency: readonly (readonly number[])[],
): number[] | null {
  return dfsTrace(n, adjacency).cycle;
}

/**
 * The first cycle in the resource-allocation graph, as node names
 * (`['T1', 'R1', 'T3', 'R2', 'T1']`), or `null`. Nodes: threads `0..n − 1`, then
 * resource types `n..n + m − 1`.
 */
export function ragCycle(
  m: Pick<RagMatrices, 'allocation' | 'request'>,
): NodeId[] | null {
  const n = m.allocation.length;
  const k = m.allocation[0]?.length ?? 0;
  const adjacency: number[][] = Array.from({ length: n + k }, () => []);
  m.request.forEach((row, t) =>
    row.forEach((wanted, r) => {
      if (wanted > 0) adjacency[t]!.push(n + r);
    }),
  );
  m.allocation.forEach((row, t) =>
    row.forEach((held, r) => {
      if (held > 0) adjacency[n + r]!.push(t);
    }),
  );
  const cycle = findCycle(n + k, adjacency);
  return cycle
    ? cycle.map((node) => (node < n ? processName(node) : resourceName(node - n)))
    : null;
}

/** A wait-for cycle `[a, b, a]` as graph nodes `['Ta', 'Rx', 'Tb', 'Ry', 'Ta']`. */
export function waitCycleToRag(
  cycle: readonly number[],
  edges: readonly WaitEdge[],
): NodeId[] {
  const nodes: NodeId[] = [processName(cycle[0]!)];
  for (let i = 1; i < cycle.length; i += 1) {
    const from = cycle[i - 1]!;
    const to = cycle[i]!;
    const edge = edges.find((e) => e.from === from && e.to === to)!;
    nodes.push(resourceName(edge.resource), processName(to));
  }
  return nodes;
}

export function formatCycle(nodes: readonly NodeId[]): string {
  return nodes.join(' → ');
}

function formatWaitEdges(edges: readonly WaitEdge[]): string {
  return edges
    .map(
      (e) =>
        `${processName(e.from)} → ${processName(e.to)} (${resourceName(e.resource)})`,
    )
    .join(', ');
}

/**
 * Cycle detection on a single-instance graph, as steps: the wait-for graph, then the DFS.
 * `prefix` keeps phase ids unique when detection runs again after a recovery.
 */
export function emitCycleDetection(e: Emitter, m: RagMatrices, prefix: string): void {
  const edges = waitForGraph(m);
  const n = m.allocation.length;
  const adjacency = Array.from({ length: n }, (_, u) =>
    edges.filter((edge) => edge.from === u).map((edge) => edge.to),
  );
  const resourceOf = (from: number, to: number) =>
    edges.find((edge) => edge.from === from && edge.to === to)!.resource;

  e.phase(
    `${prefix}wfg`,
    'Wait-for graph',
    'Every resource type has one instance, so collapse the resource nodes: Ti → Tj when Ti waits for something Tj holds.',
    'With one instance of everything, a deadlock is exactly a cycle of threads each waiting for the next.',
  );
  e.emit(
    'dl.wfg',
    'osc10.8.7.1',
    edges.length === 0
      ? 'Wait-for graph: no thread waits for another.'
      : `Wait-for graph: ${formatWaitEdges(edges)}.`,
    {
      algorithm: 'cycle',
      waitFor: edges,
      dfs: { colour: Array.from({ length: n }, () => 0 as const), stack: [], edge: null },
      cycle: null,
      work: null,
      finish: null,
      order: [],
    },
    {
      detail:
        'Ti → Tj means Ti requested a resource that Tj holds. A cycle in this graph means deadlock, and no cycle means none (OSC10 §8.7.1).',
    },
  );

  const { steps, cycle } = dfsTrace(n, adjacency);
  let root = -1;
  for (const step of steps) {
    if (step.kind === 'visit' && step.state.stack.length === 1) {
      root = step.node;
      e.phase(
        `${prefix}dfs-${processName(root)}`,
        `DFS from ${processName(root)}`,
        `Depth-first search from ${processName(root)}, the lowest-numbered thread not yet visited. Neighbours are taken in ascending order.`,
        'Follow waits-for edges. Coming back to a thread already on the path closes a cycle.',
      );
    }
    switch (step.kind) {
      case 'visit':
        e.emit(
          'dl.visit',
          'osc10.8.7.1',
          `Visit ${processName(step.node)}. Path: ${step.state.stack.map(processName).join(' → ')}.`,
          { dfs: step.state, row: step.node },
          { process: step.node },
        );
        break;
      case 'edge': {
        const resource = resourceOf(step.from, step.to);
        const via = `${processName(step.from)} waits for ${processName(step.to)} (${resourceName(resource)})`;
        e.emit(
          'dl.edge',
          'osc10.8.7.1',
          step.seen === 0
            ? `${via}. ${processName(step.to)} is not visited yet: go deeper.`
            : step.seen === 1
              ? `${via}. ${processName(step.to)} is already on the path: a cycle.`
              : `${via}. ${processName(step.to)} is done and led to no cycle: skip it.`,
          {
            dfs: { ...step.state, edge: { from: step.from, to: step.to, resource } },
            row: step.from,
          },
          { process: step.from, resource },
        );
        break;
      }
      case 'backtrack': {
        const parent = step.state.stack.at(-1);
        e.emit(
          'dl.backtrack',
          'osc10.8.7.1',
          parent === undefined
            ? `${processName(step.node)} has no more edges: done. Back at the root.`
            : `${processName(step.node)} has no more edges: done, back to ${processName(parent)}.`,
          { dfs: step.state, row: step.node },
          { process: step.node },
        );
        break;
      }
      case 'cycle':
        break;
    }
  }

  e.phase(
    `${prefix}cycle-result`,
    cycle ? 'Cycle found' : 'No cycle',
    cycle
      ? 'With one instance of each resource type, a cycle in the wait-for graph is a deadlock.'
      : 'The DFS visited every thread without finding a back edge.',
  );
  if (cycle) {
    const nodes = waitCycleToRag(cycle, edges);
    const members = [...new Set(cycle)].sort((a, b) => a - b);
    e.emit(
      'dl.cycle',
      'osc10.8.7.1',
      `Deadlock: cycle ${formatCycle(nodes)}.`,
      {
        dfs: steps.at(-1)!.state,
        cycle: nodes,
        result: { kind: 'cycle', cycle: nodes },
      },
      {
        detail: `Every resource type has one instance, so the cycle is a deadlock: ${listProcesses(members)} each wait for the next and none can go on.`,
      },
    );
  } else {
    e.emit(
      'dl.acyclic',
      'osc10.8.7.1',
      'No cycle in the wait-for graph: the system is not deadlocked.',
      {
        dfs: steps.at(-1)?.state ?? e.state.dfs,
        cycle: null,
        result: { kind: 'acyclic' },
      },
    );
  }
}
