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
  /** The rule in plain words, for someone meeting it for the first time (UIUX G4). */
  plain?: string;
  /** What would change if a textbook used the other convention (UIUX G4). */
  whyItMatters?: string;
  citation: CitationId;
}

export const DL_RULES: readonly DlRule[] = [
  {
    id: 'dl.names',
    text: 'Threads are T0, T1, … and resource types R0, R1, …, both numbered from 0.',
    detail:
      'OSC10 calls them threads (T). Its graph figures number from T1 and R1 and its matrix examples name resources A, B, C; the presets renumber them from 0 and say so.',
    plain:
      'Threads are called T0, T1, … and resources R0, R1, …, counting from 0, as in Silberschatz.',
    whyItMatters:
      'Your book may start at T1 or call resources A, B, C. The algorithm is the same; only the names shift, so check the numbering before comparing answers.',
    citation: 'osc10.8.1',
  },
  {
    id: 'dl.matrices',
    text: 'Allocation, Request and Available are read off the graph’s edges, so the graph and the matrices always agree. A resource type never has more instances assigned than it has, and a thread never holds plus requests more than exist.',
    plain:
      'The matrices are just the graph written as numbers, so the two can never disagree.',
    whyItMatters:
      'If you fill the matrices by hand from a figure, they must match its arrows exactly; an extra or missing edge changes every later step.',
    citation: 'osc10.8.7.2',
  },
  {
    id: 'dl.scan.order',
    text: 'Detection and the safety algorithm look for “some i with Finish[i] = false and Request_i (or Need_i) ≤ Work”. This model restarts the scan from T0 after every finish and takes the lowest-numbered thread that fits.',
    detail:
      'The textbook leaves the choice open, so the order shown is one valid order, not the only one. OSC10 §8.6.3.3 gives ⟨T1, T3, T4, T2, T0⟩ for its example; this rule gives ⟨T1, T3, T0, T2, T4⟩. Both are safe.',
    plain:
      'When several threads could finish next, the lowest-numbered one goes first, and the search starts again from T0.',
    whyItMatters:
      'The textbook lets you pick any thread that fits, so its safe sequence may differ from this one. Both are correct: a state is safe if at least one order works.',
    citation: 'osc10.8.6.3.1',
  },
  {
    id: 'dl.detect.finish',
    text: 'Detection starts with Finish[i] = true for every thread that holds nothing; the safety algorithm starts with every Finish[i] false.',
    detail:
      'A thread holding nothing cannot be part of a deadlock, even if it is waiting (OSC10 §8.7.2).',
    plain:
      'Detection skips threads that hold nothing (they can’t be part of a deadlock); Banker’s safety check starts with every thread unfinished.',
    whyItMatters:
      'If you start detection with every Finish false instead, the order you write down can differ, but the deadlocked threads found are the same.',
    citation: 'osc10.8.7.2',
  },
  {
    id: 'dl.dfs.order',
    text: 'Cycle detection runs a depth-first search from the lowest-numbered unvisited thread, takes neighbours in ascending order, and reports the first cycle found.',
    detail:
      'In the full resource-allocation graph (used for circular wait and the summary) threads come before resource types.',
    plain:
      'The search for a cycle starts at the lowest-numbered thread and tries neighbours in number order, and stops at the first cycle it finds.',
    whyItMatters:
      'A graph can have several cycles. Another search order may report a different one first; the answer “deadlocked or not” is the same.',
    citation: 'osc10.8.7.1',
  },
  {
    id: 'dl.wfg',
    text: 'The wait-for graph has Ti → Tj when Ti requests a resource type Tj holds. If there are several, the edge names the lowest-numbered one.',
    plain:
      'In the wait-for graph, an arrow Ti → Tj means Ti is waiting for something Tj holds.',
    whyItMatters:
      'When Ti waits on several resources Tj holds, only the label on the arrow changes; the arrows, and any cycle, are the same.',
    citation: 'osc10.8.7.1',
  },
  {
    id: 'dl.cycle.multi',
    text: 'Cycle detection decides deadlock only when every resource type has one instance. With any multi-instance type, a cycle is necessary but not sufficient, and the run hands over to the detection algorithm.',
    plain:
      'A cycle proves deadlock only when every resource has one instance. With more instances, the full detection algorithm decides.',
    whyItMatters:
      'A cycle in a multi-instance graph may not be a deadlock (try the “Cycle but no deadlock” preset). Answering “deadlocked” from the cycle alone is a classic exam mistake.',
    citation: 'osc10.8.3.2',
  },
  {
    id: 'dl.request.steps',
    text: 'A Banker’s request is checked in order: Request ≤ Need (else an error: the maximum claim is exceeded), Request ≤ Available (else wait), pretend to allocate, run the safety algorithm, then grant or roll back. Each check is its own step and a failed check ends the run.',
    plain:
      'A request is checked in four steps: not more than the thread declared, not more than is free, pretend to grant it, then check the result is safe.',
    whyItMatters:
      'Some books merge the first two checks. Keeping them apart shows why a request fails: an error (it broke its promise) is different from a wait (not enough is free yet).',
    citation: 'osc10.8.6.3.2',
  },
  {
    id: 'dl.recover.terminate',
    text: 'Terminating a thread releases everything it holds and drops its requests. Detection then runs again on what is left.',
    plain:
      'Ending a thread frees everything it held, then the system checks again for deadlock.',
    whyItMatters:
      'Books describe aborting all deadlocked threads or one at a time; this simulator does one at a time, so you can see whether one is enough.',
    citation: 'osc10.8.8.1',
  },
  {
    id: 'dl.recover.preempt',
    text: 'Preempting takes one instance of a resource from a thread. The thread is rolled back and must request that instance again, so its Request goes up by one. Detection then runs again.',
    detail:
      'OSC10 §8.8.2 leaves how far to roll back open; this model rolls back just past the one acquisition.',
    plain:
      'Taking one instance back from a thread forces it to ask for it again, then the system checks again.',
    whyItMatters:
      'How far a thread is rolled back is left open by the textbook. Rolling back further would free more, so another book’s recovery could end sooner.',
    citation: 'osc10.8.8.2',
  },
  {
    id: 'dl.coffman',
    text: 'Of the four Coffman conditions, hold and wait and circular wait are evaluated on the graph. Mutual exclusion and no preemption are assumed by the model; no preemption shows as violated after a preempt recovery.',
    detail: 'All four are necessary for deadlock, not sufficient.',
    plain:
      'Two conditions are checked on the graph (hold and wait, circular wait). The other two are always true here: this simulator never shares a resource instance and never takes one back unless you preempt it.',
    whyItMatters:
      'All four must hold for deadlock, but all four holding does not prove deadlock when a resource has several instances.',
    citation: 'osc10.8.3.1',
  },
];
