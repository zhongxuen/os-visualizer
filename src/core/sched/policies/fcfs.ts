import { pickHead, type SchedPolicy } from './types';

/** First come, first served: the head of the ready queue runs to the end of its burst. */
export function fcfsPolicy(): SchedPolicy {
  return {
    levels: 1,
    citation: 'osc10.5.3.1',
    name: 'FCFS',
    queueFor: () => 0,
    quantum: () => null,
    pick: (view) => pickHead(view, 'first in the ready queue'),
    preempt: () => null,
  };
}
