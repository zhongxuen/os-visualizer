/**
 * The graph run: look for a deadlock, then apply each recovery action (OSC10 §8.8) and
 * look again.
 *
 * - `method: 'cycle'` runs cycle detection on the wait-for graph when every resource
 *   type has one instance. With a multi-instance resource a cycle is necessary but not
 *   sufficient, so one step says so and hands over to the detection algorithm.
 * - `method: 'detect'` runs the detection algorithm directly.
 *
 * Recovery: **terminate Ti** releases everything Ti holds and drops its requests;
 * **preempt 1 of Rj from Ti** returns one instance to Available and rolls Ti back, so it
 * must request that instance again (its Request grows by one). After each action
 * detection re-runs on the new graph.
 */

import { blankSnapshot, createEmitter, type DlRun, type Emitter } from './emitter';
import { detect, emitDetection } from './detect';
import {
  emitCycleDetection,
  formatCycle,
  ragCycle,
  waitForGraph,
  findCycle,
} from './graph';
import {
  applyRecovery,
  copyMatrix,
  deriveMatrices,
  describeRecovery,
  formatVector,
  isSingleInstance,
  processName,
  resourceName,
  type Graph,
  type RagMatrices,
  type Recovery,
} from './model';

export const METHODS = ['cycle', 'detect'] as const;

export type Method = (typeof METHODS)[number];

export const METHOD_NAMES: Record<Method, string> = {
  cycle: 'Cycle detection (wait-for graph)',
  detect: 'Detection algorithm',
};

/** Is the system deadlocked, by the method's own test? */
export function isDeadlocked(m: RagMatrices, method: Method): boolean {
  if (method === 'cycle' && isSingleInstance(m.total)) {
    const edges = waitForGraph(m);
    const n = m.allocation.length;
    return (
      findCycle(
        n,
        Array.from({ length: n }, (_, u) =>
          edges.filter((e) => e.from === u).map((e) => e.to),
        ),
      ) !== null
    );
  }
  return detect(m).deadlocked;
}

function emitLook(e: Emitter, m: RagMatrices, method: Method, prefix: string) {
  if (method === 'cycle' && isSingleInstance(m.total)) {
    emitCycleDetection(e, m, prefix);
    return;
  }
  if (method === 'cycle') {
    const multi = m.total.flatMap((n, r) => (n > 1 ? [r] : []));
    const cycle = ragCycle(m);
    const first = multi[0]!;
    e.phase(
      `${prefix}multi`,
      'Several instances',
      'A cycle only proves deadlock when every resource type has one instance.',
      'With spare instances, a thread in a cycle may still get what it needs from a thread outside the cycle.',
    );
    e.emit(
      'dl.multi',
      'osc10.8.3.2',
      `${resourceName(first)} has ${m.total[first]} instances: a cycle is necessary but not sufficient here. Hand over to the detection algorithm.`,
      { algorithm: 'detect', cycle, waitFor: null, dfs: null },
      {
        resource: first,
        detail: cycle
          ? `The graph does have a cycle, ${formatCycle(cycle)}, but that alone does not decide it. The detection algorithm works with counts instead (OSC10 §8.7.2).`
          : 'The graph has no cycle, so it cannot be deadlocked; the detection algorithm confirms it with counts (OSC10 §8.7.2).',
      },
    );
  }
  emitDetection(e, m, prefix);
}

/**
 * Look for a deadlock in `graph`, then apply `recovery` in order, looking again after
 * each action. Expects a valid graph and valid recovery (see `recoveryIssues`).
 */
export function runGraph(
  graph: Graph,
  method: Method,
  recovery: readonly Recovery[] = [],
): DlRun {
  let m = deriveMatrices(graph);
  const e = createEmitter(
    blankSnapshot({
      algorithm: method === 'cycle' && isSingleInstance(m.total) ? 'cycle' : 'detect',
      total: [...m.total],
      allocation: copyMatrix(m.allocation),
      request: copyMatrix(m.request),
      available: [...m.available],
    }),
  );
  emitLook(e, m, method, '');

  const terminated: number[] = [];
  const preempted: { t: number; r: number }[] = [];
  recovery.forEach((action, i) => {
    const next = applyRecovery(m, terminated, action);
    if (!next.ok) throw new Error(`Invalid recovery ${i}: ${next.message}`);
    const before = m;
    m = next.value;
    const name = processName(action.t);
    let label: string;
    let detail: string;
    if (action.kind === 'terminate') {
      terminated.push(action.t);
      label = `Recovery: terminate ${name}. It releases ${formatVector(before.allocation[action.t]!)}; Available = ${formatVector(m.available)}.`;
      detail = `Aborting a thread breaks every cycle through it. Its work is lost and it has to start again later (OSC10 §8.8.1).`;
    } else {
      preempted.push({ t: action.t, r: action.r });
      label = `Recovery: preempt 1 of ${resourceName(action.r)} from ${name}. Available = ${formatVector(m.available)}.`;
      detail = `${name} is rolled back to before it acquired the instance and must request it again, so its Request for ${resourceName(action.r)} goes up by one. Taking a resource away breaks the "no preemption" condition (OSC10 §8.8.2).`;
    }
    e.phase(
      `r${i + 1}.recover`,
      describeRecovery(action),
      'Break the deadlock by force, then run detection again on what is left.',
      'Someone has to lose something: a whole thread, or one resource it was holding.',
    );
    e.emit(
      'dl.recover',
      action.kind === 'terminate' ? 'osc10.8.8.1' : 'osc10.8.8.2',
      label,
      {
        algorithm: 'recover',
        allocation: copyMatrix(m.allocation),
        request: copyMatrix(m.request),
        available: [...m.available],
        terminated: [...terminated],
        preempted: preempted.map((p) => ({ ...p })),
        work: null,
        finish: null,
        order: [],
        waitFor: null,
        dfs: null,
        cycle: null,
        row: action.t,
        changed:
          action.kind === 'terminate'
            ? before.allocation[action.t]!.flatMap((n, r) =>
                n > 0 ? [[action.t, r] as [number, number]] : [],
              )
            : [[action.t, action.r]],
      },
      {
        process: action.t,
        ...(action.kind === 'preempt' ? { resource: action.r } : {}),
        detail,
      },
    );
    emitLook(e, m, method, `r${i + 1}.`);
  });
  return e.finish();
}
