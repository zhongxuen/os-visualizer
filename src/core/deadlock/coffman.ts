/**
 * The four Coffman conditions (OSC10 §8.3.1), shown honestly: a graph can show hold and
 * wait and circular wait, but mutual exclusion and no preemption are properties of the
 * model, so they are marked "assumed", until the user preempts a resource, which breaks
 * no preemption.
 *
 * All four are necessary for deadlock, none is sufficient, and neither are all four
 * together when a resource type has several instances.
 */

import type { CitationId } from '../citations/types';
import { formatCycle, ragCycle } from './graph';
import { listProcesses, type RagMatrices } from './model';

export type CoffmanId =
  'mutual-exclusion' | 'hold-and-wait' | 'no-preemption' | 'circular-wait';

export type CoffmanStatus =
  /** A property of the model, not something the graph shows. */
  | 'assumed'
  /** Evaluated on the graph: the condition holds. */
  | 'holds'
  /** Evaluated on the graph: the condition does not hold. */
  | 'absent'
  /** The user broke it (a preempt recovery). */
  | 'violated';

export interface CoffmanCondition {
  id: CoffmanId;
  name: string;
  status: CoffmanStatus;
  /** Why, in one sentence. */
  text: string;
  citation: CitationId;
}

export const COFFMAN_FOOTNOTE =
  'All four conditions are necessary for deadlock, not sufficient: with several instances of a resource type they can all hold while every thread can still finish.';

/** The conditions for some matrices; `preempted` is true once a preempt recovery ran. */
export function coffman(
  m: Pick<RagMatrices, 'allocation' | 'request'>,
  preempted = false,
): CoffmanCondition[] {
  const holdWait = m.allocation.flatMap((row, t) =>
    row.some((n) => n > 0) && m.request[t]!.some((n) => n > 0) ? [t] : [],
  );
  const cycle = ragCycle(m);
  return [
    {
      id: 'mutual-exclusion',
      name: 'Mutual exclusion',
      status: 'assumed',
      text: 'Assumed by the model: every resource instance is non-sharable, held by at most one thread at a time.',
      citation: 'osc10.8.3.1',
    },
    {
      id: 'hold-and-wait',
      name: 'Hold and wait',
      status: holdWait.length > 0 ? 'holds' : 'absent',
      text:
        holdWait.length > 0
          ? `${listProcesses(holdWait)} ${holdWait.length === 1 ? 'holds' : 'hold'} at least one instance while waiting for another.`
          : 'No thread holds a resource while waiting for another.',
      citation: 'osc10.8.3.1',
    },
    {
      id: 'no-preemption',
      name: 'No preemption',
      status: preempted ? 'violated' : 'assumed',
      text: preempted
        ? 'Violated by you: a recovery step took a resource away from the thread holding it.'
        : 'Assumed by the model: a resource is released only by the thread holding it, voluntarily.',
      citation: preempted ? 'osc10.8.8.2' : 'osc10.8.3.1',
    },
    {
      id: 'circular-wait',
      name: 'Circular wait',
      status: cycle ? 'holds' : 'absent',
      text: cycle
        ? `The resource-allocation graph has a cycle: ${formatCycle(cycle)}.`
        : 'The resource-allocation graph has no cycle.',
      citation: 'osc10.8.3.2',
    },
  ];
}
