/**
 * The modelling conventions the scheduler follows, as data. The RulesPanel renders them;
 * `tests/fixtures/sched/rules.test.ts` has one test named after each id. Where
 * textbooks disagree, the rule says which convention was chosen.
 */

import type { PolicyKind } from './workload';

export interface SchedRule {
  id: string;
  text: string;
  detail?: string;
  /** Policies the rule matters for; absent = all. */
  policies?: readonly PolicyKind[];
}

export const SCHED_RULES: readonly SchedRule[] = [
  {
    id: 'sched.order.arrivals',
    text: 'Processes arriving on the same tick join the ready queue lowest PID first.',
  },
  {
    id: 'sched.order.io',
    text: 'Processes returning from I/O join after that tick’s arrivals, lowest PID first.',
  },
  {
    id: 'sched.order.quantum',
    text: 'A process whose quantum expires goes to the tail of its queue, behind processes that arrived or returned from I/O on the same tick.',
    detail: 'The Silberschatz and OSTEP convention. Some courses put it ahead instead.',
    policies: ['rr', 'mlfq'],
  },
  {
    id: 'sched.order.finish',
    text: 'A process that finishes its CPU burst on the last tick of its quantum leaves for I/O or finishes; that is not a quantum expiry.',
    policies: ['rr', 'mlfq'],
  },
  {
    id: 'sched.tie.pid',
    text: 'When the policy’s key ties (same burst, same remaining time, same priority), the lower PID runs first.',
  },
  {
    id: 'sched.preempt.equal',
    text: 'Equal keys never preempt: SRTF with equal remaining time, or priority with equal priority, keeps the running process.',
    policies: ['srtf', 'priority', 'mlfq'],
  },
  {
    id: 'sched.preempt.tail',
    text: 'A preempted process goes to the tail of its ready queue.',
    policies: ['srtf', 'priority', 'mlfq'],
  },
  {
    id: 'sched.cs.cost',
    text: 'A context switch costs the set number of ticks whenever the CPU starts a process other than the one that ran last. The very first dispatch is free. Context-switch ticks are neither busy nor idle.',
  },
  {
    id: 'sched.cs.atomic',
    text: 'A context switch, once started, completes, and the process switched to runs at least one tick before it can be preempted.',
  },
  {
    id: 'sched.priority.lower',
    text: 'Lower priority number = higher priority (0 is the highest).',
    detail: 'Silberschatz’s convention.',
    policies: ['priority'],
  },
  {
    id: 'sched.priority.aging',
    text: 'Aging lowers a ready process’s priority number by the step for every interval it waits, floored at 0, and resets to its base priority when it runs.',
    policies: ['priority'],
  },
  {
    id: 'sched.sjf.next',
    text: 'SJF and SRTF use the length of the next CPU burst, known in advance, as the textbooks assume.',
    policies: ['sjf', 'srtf'],
  },
  {
    id: 'sched.io.fixed',
    text: 'I/O is a fixed wait with no device queue: a process starting a d-tick I/O burst at t is ready again at t + d.',
  },
  {
    id: 'sched.mlfq.enter',
    text: 'MLFQ: a new job enters the top queue, Q0 (rule 3), and a job in a higher queue always runs first and preempts a lower one (rule 1). Jobs in one queue run round robin (rule 2).',
    policies: ['mlfq'],
  },
  {
    id: 'sched.mlfq.allotment',
    text: 'MLFQ, rule 4 (allotment): time used at a level is counted across I/O; when it reaches the level’s allotment, the job moves down one queue.',
    policies: ['mlfq'],
  },
  {
    id: 'sched.mlfq.original',
    text: 'MLFQ, old rules 4a/4b: a job that uses a whole quantum moves down; a job that gives up the CPU before its quantum ends keeps its level, so it can game the scheduler.',
    detail:
      'Finishing a burst on the last tick of the quantum counts as using the whole quantum.',
    policies: ['mlfq'],
  },
  {
    id: 'sched.mlfq.boost',
    text: 'MLFQ, rule 5: every boost interval, every job moves to Q0 and its allotment resets. Ready jobs keep their order, higher queues first; a running job keeps the CPU and the part of its quantum already used.',
    policies: ['mlfq'],
  },
  {
    id: 'sched.limit',
    text: 'A run stops at 300 ticks with a “limit reached” event rather than running forever.',
  },
];

/** The rules that matter for one policy. */
export function rulesFor(kind: PolicyKind): SchedRule[] {
  return SCHED_RULES.filter((rule) => !rule.policies || rule.policies.includes(kind));
}
