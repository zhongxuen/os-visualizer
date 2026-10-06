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
  /** The rule in plain words, for someone meeting it for the first time (G4). */
  plain?: string;
  /** What would change if a textbook used the other convention (G4). */
  whyItMatters?: string;
  /** Policies the rule matters for; absent = all. */
  policies?: readonly PolicyKind[];
}

export const SCHED_RULES: readonly SchedRule[] = [
  {
    id: 'sched.order.arrivals',
    text: 'Processes arriving on the same tick join the ready queue lowest PID first.',
    plain:
      'Two processes arriving at the same moment queue up in PID order: P1 before P2.',
    whyItMatters:
      'FCFS and Round Robin results depend on queue order. A book that breaks the tie another way (by listing order, say) gives the same answer only when its list is already in PID order.',
  },
  {
    id: 'sched.order.io',
    text: 'Processes returning from I/O join after that tick’s arrivals, lowest PID first.',
    plain:
      'A process coming back from I/O queues behind anything that arrived on the same tick.',
    whyItMatters:
      'Swap the two and a returning process jumps ahead of a newcomer, which changes who runs next under FCFS and Round Robin.',
  },
  {
    id: 'sched.order.quantum',
    text: 'A process whose quantum expires goes to the tail of its queue, behind processes that arrived or returned from I/O on the same tick.',
    detail: 'The Silberschatz and OSTEP convention. Some courses put it ahead instead.',
    policies: ['rr', 'mlfq'],
    plain:
      'When a process’s time slice runs out, it goes to the back of the line, behind anything that arrived at that same moment.',
    whyItMatters:
      'This is the tie that most often makes a homework answer differ by one slot. If your course puts the expired process ahead of new arrivals, the Round Robin order after that tick changes.',
  },
  {
    id: 'sched.order.finish',
    text: 'A process that finishes its CPU burst on the last tick of its quantum leaves for I/O or finishes; that is not a quantum expiry.',
    policies: ['rr', 'mlfq'],
    plain:
      'Finishing exactly as the time slice ends counts as finishing, not as running out of time.',
    whyItMatters:
      'Otherwise the process would be put back in the queue for a burst it has already finished, and MLFQ could demote it for no reason.',
  },
  {
    id: 'sched.tie.pid',
    text: 'When the policy’s key ties (same burst, same remaining time, same priority), the lower PID runs first.',
    plain:
      'When two processes look equally good to the policy, the one with the lower number runs first.',
    whyItMatters:
      'Every textbook needs some tie-break; a different one (arrival order, say) can swap two processes in the Gantt chart and shift waiting times.',
  },
  {
    id: 'sched.preempt.equal',
    text: 'Equal keys never preempt: SRTF with equal remaining time, or priority with equal priority, keeps the running process.',
    policies: ['srtf', 'priority', 'mlfq'],
    plain:
      'A newcomer only takes the CPU if it is strictly better. A tie leaves the running process where it is.',
    whyItMatters:
      'Preempting on a tie would add context switches and change the Gantt chart without improving anything; some exercises expect the tie to preempt, so check yours.',
  },
  {
    id: 'sched.preempt.tail',
    text: 'A preempted process goes to the tail of its ready queue.',
    policies: ['srtf', 'priority', 'mlfq'],
    plain:
      'A process that loses the CPU to a better one goes to the back of the ready queue.',
    whyItMatters:
      'Putting it at the front instead changes who runs after the newcomer whenever the queue has more than one waiting process.',
  },
  {
    id: 'sched.cs.cost',
    text: 'A context switch costs the set number of ticks whenever the CPU starts a process other than the one that ran last. The very first dispatch is free. Context-switch ticks are neither busy nor idle.',
    plain:
      'Switching the CPU to a different process takes a few ticks of overhead. Nobody’s work gets done in that time, and the very first start costs nothing.',
    whyItMatters:
      'Most textbook exercises set the cost to 0. With a cost, the averages get worse, and utilisation counts those ticks as not busy.',
  },
  {
    id: 'sched.cs.atomic',
    text: 'A context switch, once started, completes, and the process switched to runs at least one tick before it can be preempted.',
    plain:
      'Once a switch has started it finishes, and the new process gets at least one tick before anyone can take the CPU from it.',
    whyItMatters:
      'Without this, a burst of arrivals could keep interrupting switches and no process would ever run.',
  },
  {
    id: 'sched.priority.lower',
    text: 'Lower priority number = higher priority (0 is the highest).',
    detail: 'Silberschatz’s convention.',
    policies: ['priority'],
    plain:
      'A smaller priority number means more important: priority 0 runs before priority 3.',
    whyItMatters:
      'Some books and real systems use the opposite direction. Flip it and the whole schedule reverses, so check which way your exercise counts.',
  },
  {
    id: 'sched.priority.aging',
    text: 'Aging lowers a ready process’s priority number by the step for every interval it waits, floored at 0, and resets to its base priority when it runs.',
    policies: ['priority'],
    plain:
      'The longer a process waits, the more important it gets, a little at a time, until it runs. Then it goes back to its normal priority.',
    whyItMatters:
      'Aging is what stops low-priority processes from starving. Books differ on the interval and the step, so match those numbers to your exercise.',
  },
  {
    id: 'sched.sjf.next',
    text: 'SJF and SRTF use the length of the next CPU burst, known in advance, as the textbooks assume.',
    policies: ['sjf', 'srtf'],
    plain:
      'SJF and SRTF are told how long each process’s next CPU burst will be. A real scheduler would have to guess.',
    whyItMatters:
      'This is why SJF is the yardstick for average waiting time and not something a kernel can run as is; real systems estimate the burst (exponential averaging).',
  },
  {
    id: 'sched.io.fixed',
    text: 'I/O is a fixed wait with no device queue: a process starting a d-tick I/O burst at t is ready again at t + d.',
    plain:
      'I/O takes exactly the time you set. There is no disk queue, so two processes can do I/O at the same time.',
    whyItMatters:
      'A model with a device queue would make processes wait for each other’s I/O, and their return times would change.',
  },
  {
    id: 'sched.mlfq.enter',
    text: 'MLFQ: a new job enters the top queue, Q0 (rule 3), and a job in a higher queue always runs first and preempts a lower one (rule 1). Jobs in one queue run round robin (rule 2).',
    policies: ['mlfq'],
    plain:
      'New jobs start in the top queue. Higher queues always go first, and jobs in the same queue take turns.',
    whyItMatters:
      'These are OSTEP’s rules 1-3. They favour short and interactive jobs, because a new job always gets a chance at the top.',
  },
  {
    id: 'sched.mlfq.allotment',
    text: 'MLFQ, rule 4 (allotment): time used at a level is counted across I/O; when it reaches the level’s allotment, the job moves down one queue.',
    policies: ['mlfq'],
    plain:
      'Each queue gives a job a time budget. Once it has used that much at this level, even across I/O, it moves down a queue.',
    whyItMatters:
      'This is OSTEP’s fixed rule 4. Under the old rules a job could stay at the top forever by doing I/O just before its slice ended.',
  },
  {
    id: 'sched.mlfq.original',
    text: 'MLFQ, old rules 4a/4b: a job that uses a whole quantum moves down; a job that gives up the CPU before its quantum ends keeps its level, so it can game the scheduler.',
    detail:
      'Finishing a burst on the last tick of the quantum counts as using the whole quantum.',
    policies: ['mlfq'],
    plain:
      'A job moves down only if it uses a whole time slice. Giving up the CPU early, for example for I/O, keeps its level.',
    whyItMatters:
      'This is OSTEP’s original rule 4, kept to show how it can be gamed. Most courses now teach the allotment version.',
  },
  {
    id: 'sched.mlfq.boost',
    text: 'MLFQ, rule 5: every boost interval, every job moves to Q0 and its allotment resets. Ready jobs keep their order, higher queues first; a running job keeps the CPU and the part of its quantum already used.',
    policies: ['mlfq'],
    plain:
      'Every so often, every job goes back to the top queue, so long-running jobs are not starved.',
    whyItMatters:
      'Without a boost, a steady stream of short jobs can starve the jobs in the bottom queue. A shorter interval is fairer but helps interactive jobs less.',
  },
  {
    id: 'sched.limit',
    text: 'A run stops at 300 ticks with a “limit reached” event rather than running forever.',
    plain:
      'A run stops after 300 ticks, so a mistake in the workload cannot run forever.',
    whyItMatters:
      'Only workloads that run past 300 ticks are affected; any process not finished by then has no completion time.',
  },
];

/** The rules that matter for one policy. */
export function rulesFor(kind: PolicyKind): SchedRule[] {
  return SCHED_RULES.filter((rule) => !rule.policies || rule.policies.includes(kind));
}
