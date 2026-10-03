import { pickByKey, type SchedPolicy } from './types';

/**
 * Shortest job first, non-preemptive: the ready process with the shortest *next CPU
 * burst* runs to the end of it. Burst lengths are known in advance, as the textbooks
 * assume.
 */
export function sjfPolicy(): SchedPolicy {
  return {
    levels: 1,
    citation: 'osc10.5.3.2',
    name: 'SJF',
    queueFor: () => 0,
    quantum: () => null,
    pick: (view) =>
      pickByKey(
        view,
        (p) => p.remaining,
        (n) => `shortest next burst (${n})`,
      ),
    preempt: () => null,
  };
}
