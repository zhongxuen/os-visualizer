import { minByKey, pickByKey, readyPids, type SchedPolicy } from './types';

/**
 * Shortest remaining time first (OSTEP's STCF): preemptive SJF. A ready process with
 * strictly less time left in its CPU burst than the running one preempts it; equal
 * remaining time never preempts.
 */
export function srtfPolicy(): SchedPolicy {
  return {
    levels: 1,
    citation: 'osc10.5.3.2',
    name: 'SRTF',
    queueFor: () => 0,
    quantum: () => null,
    pick: (view) =>
      pickByKey(
        view,
        (p) => p.remaining,
        (n) => `shortest remaining time (${n})`,
      ),
    preempt: (view, running) => {
      const best = minByKey(readyPids(view), (pid) => view.procs[pid]!.remaining);
      if (!best) return null;
      const left = view.procs[best.pid]!.remaining;
      if (left >= running.remaining) return null;
      return {
        pid: best.pid,
        reason: `${best.pid} preempts ${running.pid}: ${left} ticks left < ${running.remaining}`,
      };
    },
  };
}
