import { pickHead, type SchedPolicy } from './types';

/**
 * Round robin: the head of the ready queue runs for at most `quantum` ticks, then goes to
 * the tail (behind anything that arrived on the same tick; the kernel does the ordering).
 */
export function rrPolicy(quantum: number): SchedPolicy {
  return {
    levels: 1,
    citation: 'osc10.5.3.3',
    name: `RR q=${quantum}`,
    queueFor: () => 0,
    quantum: () => quantum,
    pick: (view) => pickHead(view, `head of the ready queue, for up to ${quantum} ticks`),
    preempt: () => null,
  };
}
