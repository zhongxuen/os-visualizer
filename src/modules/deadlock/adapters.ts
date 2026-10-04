/**
 * Turning a deadlock run into words and shapes. Pure functions, no React: the module
 * renders the core's decisions, it never makes its own.
 */

import { coffman, type CoffmanCondition } from '@/core/deadlock/coffman';
import type { DlRun } from '@/core/deadlock/emitter';
import type { DlEvent, DlResult, DlSnapshot } from '@/core/deadlock/events';
import { formatCycle, ragCycle } from '@/core/deadlock/graph';
import {
  applyRecovery,
  deriveMatrices,
  describeRecovery,
  graphFromMatrices,
  listProcesses,
  processName,
  resourceName,
  type Graph,
  type RagMatrices,
  type Recovery,
} from '@/core/deadlock/model';

/** The event on screen at step position `step` (0-based; the end clamps to the last). */
export function eventAt(run: DlRun, step: number): DlEvent | undefined {
  if (run.events.length === 0) return undefined;
  return run.events[Math.max(0, Math.min(step, run.events.length - 1))];
}

export function processLabels(n: number): string[] {
  return Array.from({ length: n }, (_, t) => processName(t));
}

export function resourceLabels(m: number): string[] {
  return Array.from({ length: m }, (_, r) => resourceName(r));
}

function count(n: number, r: number): string {
  return n === 1 ? resourceName(r) : `${n} of ${resourceName(r)}`;
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/** The graph as a snapshot shows it (after any recovery so far). */
export function graphAt(state: DlSnapshot): Graph {
  return graphFromMatrices(
    state.total,
    state.allocation,
    state.request ?? state.allocation.map((row) => row.map(() => 0)),
  );
}

/**
 * The always-available text version of the graph: one sentence per thread, then the
 * first cycle. "T1 holds R2, requests R1. Cycle: T1 → R1 → T3 → R2 → T1."
 */
export function graphSummary(
  m: Pick<RagMatrices, 'allocation' | 'request'>,
  terminated: readonly number[] = [],
): string[] {
  const lines = m.allocation.map((row, t) => {
    const name = processName(t);
    if (terminated.includes(t)) return `${name} was terminated.`;
    const holds = row.flatMap((n, r) => (n > 0 ? [count(n, r)] : []));
    const wants = m.request[t]!.flatMap((n, r) => (n > 0 ? [count(n, r)] : []));
    if (holds.length === 0 && wants.length === 0) return `${name} holds nothing.`;
    const parts = [
      holds.length > 0 ? `holds ${joinAnd(holds)}` : 'holds nothing',
      ...(wants.length > 0 ? [`requests ${joinAnd(wants)}`] : []),
    ];
    return `${name} ${parts.join(', ')}.`;
  });
  const cycle = ragCycle(m);
  lines.push(cycle ? `Cycle: ${formatCycle(cycle)}.` : 'No cycle.');
  return lines;
}

/** The result in one sentence. */
export function resultText(result: DlResult): string {
  switch (result.kind) {
    case 'cycle':
      return `Deadlocked: cycle ${formatCycle(result.cycle)}.`;
    case 'acyclic':
      return 'Not deadlocked: the wait-for graph has no cycle.';
    case 'not-deadlocked':
      return result.order.length === 0
        ? 'Not deadlocked.'
        : `Not deadlocked: ⟨${result.order.map(processName).join(', ')}⟩ can finish in turn.`;
    case 'deadlocked':
      return `Deadlocked: ${listProcesses(result.set)}.`;
    case 'safe':
      return `Safe. Safe sequence ⟨${result.order.map(processName).join(', ')}⟩ (one of possibly several).`;
    case 'unsafe':
      return `Unsafe: ${listProcesses(result.stuck)} cannot be sure to finish.`;
    case 'granted':
      return 'Granted: the state after the request is safe.';
    case 'error':
      return 'Error: the request exceeds the thread’s maximum claim.';
    case 'wait':
      return 'Wait: not enough is available.';
    case 'refused':
      return 'Refused: the state after the request would be unsafe, so the thread waits.';
  }
}

/** Whether a result is bad news (deadlock, unsafe, refused), for its colour. */
export function isBad(result: DlResult): boolean {
  return ['cycle', 'deadlocked', 'unsafe', 'error', 'refused', 'wait'].includes(
    result.kind,
  );
}

/** The last result in the run: what the whole run decided. */
export function finalResult(run: DlRun): DlResult | null {
  for (let i = run.events.length - 1; i >= 0; i -= 1) {
    const result = run.events[i]!.state.result;
    if (result) return result;
  }
  return null;
}

/** True when the graph run ends deadlocked. */
export function endsDeadlocked(run: DlRun): boolean {
  const result = finalResult(run);
  return result?.kind === 'cycle' || result?.kind === 'deadlocked';
}

/** The Coffman conditions at a step. */
export function coffmanAt(state: DlSnapshot): CoffmanCondition[] {
  return coffman(
    {
      allocation: state.allocation,
      request: state.request ?? state.allocation.map((row) => row.map(() => 0)),
    },
    state.preempted.length > 0,
  );
}

/** Threads a recovery could act on, and the resources each holds, after `recovery`. */
export function recoveryOptions(
  graph: Graph,
  recovery: readonly Recovery[],
): { terminate: number[]; preempt: { t: number; r: number }[] } {
  let m = deriveMatrices(graph);
  const terminated: number[] = [];
  for (const action of recovery) {
    const next = applyRecovery(m, terminated, action);
    if (!next.ok) break;
    m = next.value;
    if (action.kind === 'terminate') terminated.push(action.t);
  }
  const live = m.allocation.flatMap((row, t) =>
    !terminated.includes(t) &&
    (row.some((n) => n > 0) || m.request[t]!.some((n) => n > 0))
      ? [t]
      : [],
  );
  const preempt = m.allocation.flatMap((row, t) =>
    terminated.includes(t) ? [] : row.flatMap((n, r) => (n > 0 ? [{ t, r }] : [])),
  );
  return { terminate: live, preempt };
}

const KIND_NAMES: Record<DlEvent['kind'], string> = {
  'dl.wfg': 'wait-for graph',
  'dl.multi': 'several instances',
  'dl.visit': 'DFS visit',
  'dl.edge': 'DFS edge',
  'dl.backtrack': 'DFS backtrack',
  'dl.cycle': 'cycle found',
  'dl.acyclic': 'no cycle',
  'dl.init': 'set up',
  'dl.check': 'check a row',
  'dl.finish': 'thread finishes',
  'dl.result': 'result',
  'dl.req.need': 'Request ≤ Need?',
  'dl.req.available': 'Request ≤ Available?',
  'dl.req.pretend': 'pretend to allocate',
  'dl.req.grant': 'grant',
  'dl.req.rollback': 'roll back',
  'dl.recover': 'recovery',
};

/** The inspector heading for an event. */
export function stepHeading(event: DlEvent | undefined, run: DlRun): string {
  if (!event) return 'This step';
  const index = run.events.indexOf(event);
  return `Step ${index + 1} of ${run.events.length}: ${KIND_NAMES[event.kind]}`;
}

export { describeRecovery };
