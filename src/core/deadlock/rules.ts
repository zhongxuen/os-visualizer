/**
 * The modelling conventions the deadlock core follows, as data. The RulesPanel renders
 * them; `tests/fixtures/deadlock/rules.test.ts` has one test named after each id. Where
 * the textbook leaves a choice open, the rule says which one was made.
 */

import type { CitationId } from '../citations/types';

export interface DlRule {
  id: string;
  text: string;
  detail?: string;
  citation: CitationId;
}

export const DL_RULES: readonly DlRule[] = [
  {
    id: 'dl.names',
    text: 'Threads are T0, T1, … and resource types R0, R1, …, both numbered from 0.',
    detail:
      'OSC10 calls them threads (T). Its graph figures number from T1 and R1 and its matrix examples name resources A, B, C; the presets renumber them from 0 and say so.',
    citation: 'osc10.8.1',
  },
  {
    id: 'dl.matrices',
    text: 'Allocation, Request and Available are read off the graph’s edges, so the graph and the matrices always agree. A resource type never has more instances assigned than it has, and a thread never holds plus requests more than exist.',
    citation: 'osc10.8.7.2',
  },
  {
    id: 'dl.scan.order',
    text: 'Detection and the safety algorithm look for “some i with Finish[i] = false and Request_i (or Need_i) ≤ Work”. This model restarts the scan from T0 after every finish and takes the lowest-numbered thread that fits.',
    detail:
      'The textbook leaves the choice open, so the order shown is one valid order, not the only one. OSC10 §8.6.3.3 gives ⟨T1, T3, T4, T2, T0⟩ for its example; this rule gives ⟨T1, T3, T0, T2, T4⟩. Both are safe.',
    citation: 'osc10.8.6.3.1',
  },
  {
    id: 'dl.detect.finish',
    text: 'Detection starts with Finish[i] = true for every thread that holds nothing; the safety algorithm starts with every Finish[i] false.',
    detail:
      'A thread holding nothing cannot be part of a deadlock, even if it is waiting (OSC10 §8.7.2).',
    citation: 'osc10.8.7.2',
  },
  {
    id: 'dl.dfs.order',
    text: 'Cycle detection runs a depth-first search from the lowest-numbered unvisited thread, takes neighbours in ascending order, and reports the first cycle found.',
    detail:
      'In the full resource-allocation graph (used for circular wait and the summary) threads come before resource types.',
    citation: 'osc10.8.7.1',
  },
  {
    id: 'dl.wfg',
    text: 'The wait-for graph has Ti → Tj when Ti requests a resource type Tj holds. If there are several, the edge names the lowest-numbered one.',
    citation: 'osc10.8.7.1',
  },
  {
    id: 'dl.cycle.multi',
    text: 'Cycle detection decides deadlock only when every resource type has one instance. With any multi-instance type, a cycle is necessary but not sufficient, and the run hands over to the detection algorithm.',
    citation: 'osc10.8.3.2',
  },
  {
    id: 'dl.request.steps',
    text: 'A Banker’s request is checked in order: Request ≤ Need (else an error: the maximum claim is exceeded), Request ≤ Available (else wait), pretend to allocate, run the safety algorithm, then grant or roll back. Each check is its own step and a failed check ends the run.',
    citation: 'osc10.8.6.3.2',
  },
  {
    id: 'dl.recover.terminate',
    text: 'Terminating a thread releases everything it holds and drops its requests. Detection then runs again on what is left.',
    citation: 'osc10.8.8.1',
  },
  {
    id: 'dl.recover.preempt',
    text: 'Preempting takes one instance of a resource from a thread. The thread is rolled back and must request that instance again, so its Request goes up by one. Detection then runs again.',
    detail:
      'OSC10 §8.8.2 leaves how far to roll back open; this model rolls back just past the one acquisition.',
    citation: 'osc10.8.8.2',
  },
  {
    id: 'dl.coffman',
    text: 'Of the four Coffman conditions, hold and wait and circular wait are evaluated on the graph. Mutual exclusion and no preemption are assumed by the model; no preemption shows as violated after a preempt recovery.',
    detail: 'All four are necessary for deadlock, not sufficient.',
    citation: 'osc10.8.3.1',
  },
];
